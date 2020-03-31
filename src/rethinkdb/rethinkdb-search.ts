import { Query, RealtimeSearch, RealtimeSearchCallbacks, QueryOperators } from '../provider'
import { MongoClient, Collection, ChangeStream, ObjectID, FilterQuery } from 'mongodb'
import { splitEvery } from 'ramda'
import { StdLogger } from '../logger/std-logger'
import { PinoLogger } from '../logger/pino-logger'

export class RethinkDBSearch implements RealtimeSearch {
  private collection: Collection
  private changeStream: ChangeStream
  private mongoQuery: FilterQuery<any> = this.query.query
  private isReady: boolean = false

  constructor (
    private logger: StdLogger | PinoLogger,
    private database: string,
    private query: Query,
    private callbacks: RealtimeSearchCallbacks,
    private mongoClient: MongoClient,
    private primaryKey: string,
    private excludeTablePrefix: boolean,
    nativeQuery: boolean
  ) {
    if (!nativeQuery) {
      this.mongoQuery = this.convertToMongoQuery({}, this.query.query)
    } else {
      this.mongoQuery = { $returnKey: true, ...this.mongoQuery }
      this.logger.debug(`native query: ${JSON.stringify(this.mongoQuery)}`)
      this.mongoQuery.$query = objectIDConvertor({}, this.mongoQuery.$query)
    }

    const db = this.mongoClient.db(this.database)
    this.collection = db.collection(this.query.table)
    this.changeStream = this.collection.watch([], {})
    this.changeStream.on('change', this.runQuery.bind(this))
  }

  /**
   * Returns once the initial search is completed
   */
  public async whenReady (): Promise<void> {
    if (!this.isReady) {
      await this.runQuery()
      this.isReady = true
    }
  }

  /**
   * Closes the realtime-cursor. It also deletes the list if called
   * as a result of an unsubscribe call to the record listener, but not if called
   * as a result of the list being deleted.
   */
  public async stop (): Promise<void> {
    this.changeStream.close()
  }

  private async runQuery () {
    try {
      const result = await this.collection.find(this.mongoQuery).toArray()
      let entries = null
      if (this.excludeTablePrefix) {
        entries = result.map((r) => r[this.primaryKey])
      } else {
        entries = result.map((r) => `${this.query.table}/${r[this.primaryKey]}`)
      }
      this.callbacks.onResultsChanged(entries)
    } catch (error) {
      this.logger.error('Error running query', error)
    }
  }

  private convertToMongoQuery (result: any, condition: any[]): any {
    if (typeof condition[0] === 'string') {
      if (condition.length === 3) {
        return mongonize(result, condition)
      }
      if (condition.length > 3) {
        result.$or = splitEvery(3, condition).map((c) => this.convertToMongoQuery({}, c))
        return result
      }
    }

    try {
      condition.reduce((r, c) => {
        return this.convertToMongoQuery(r, c)
      }, result)
      return result
    } catch (error) {
      this.logger.error('Received an invalid search', error)
    }
  }
}
