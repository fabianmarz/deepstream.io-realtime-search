import { Query, RealtimeSearch, RealtimeSearchCallbacks } from '../provider'
import * as rethinkdb from 'rethinkdb'
import { StdLogger } from '../logger/std-logger'
import { PinoLogger } from '../logger/pino-logger'

export class RethinkDBSearch implements RealtimeSearch {
    private rethinkQuery: any = this.query.query
    private isReady: boolean = false
    // public subscription: number = 0
    // private provider: any = ''
    // private list: any = ''
    // private rethinkQuery: any = this.query.query
    private changeFeedCursor: any = null
    private initialValues: Object = {}

  constructor (
    private logger: StdLogger | PinoLogger,
    private database: string,
    private query: Query,
    private callbacks: RealtimeSearchCallbacks,
    private connection: rethinkdb.Connection,
    private primaryKey: string,
    private excludeTablePrefix: boolean,
  ) {
    // this.mongoQuery = { $returnKey: true, ...this.mongoQuery }
    // this.logger.debug(`native query: ${JSON.stringify(this.mongoQuery)}`)
    // this.mongoQuery.$query = objectIDConvertor({}, this.mongoQuery.$query)
    //
    // const db = this.mongoClient.db(this.database)
    // this.collection = db.collection(this.query.table)
    // this.changeStream = this.collection.watch([], {})
    // this.changeStream.on('change', this.runQuery.bind(this))
    this.logger.info(JSON.stringify(this.query));
    rethinkdb.table(this.query.table).filter(this.query.query).changes({
      squash: true,
      changefeedQueueSize: 100000,
      includeInitial: true,
      includeStates: true,
      includeOffsets: false,
      includeTypes: false,
    })
    .run(connection, this.runQuery.bind(this))
  }

  /**
   * Returns once the initial search is completed
   */
  public async whenReady (): Promise<void> {
    if (!this.isReady) {
      this.isReady = true
    }
  }

  /**
   * Closes the realtime-cursor. It also deletes the list if called
   * as a result of an unsubscribe call to the record listener, but not if called
   * as a result of the list being deleted.
   */
  public async stop (): Promise<void> {
    if (this.changeFeedCursor) {
      // this.changeFeedCursor.close()
      this.changeFeedCursor = null
    }
  }

  private async runQuery (error, cursor) {
    this.changeFeedCursor = cursor;
    if (error) {
      this.logger.error('Error running query', error)
    }
    const entries = [];
    cursor.each((error, row) => {
      if (row.hasOwnProperty('new_val')) {
        console.log('changed')
        entries.push(row.new_val[this.primaryKey])
      }
    });
    console.log(JSON.stringify(entries));
    this.callbacks.onResultsChanged(entries)
  }
}
