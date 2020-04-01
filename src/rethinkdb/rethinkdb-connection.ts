import { DatabaseClient, RealtimeSearchConfig, RealtimeSearchCallbacks } from '../provider'
import * as rethinkdb from 'rethinkdb'
import { RethinkDBSearch } from './rethinkdb-search'
import { Query } from '../provider'
//import { RealtimeSearch } from '../provider'
import { StdLogger } from '../logger/std-logger'
import { PinoLogger } from '../logger/pino-logger'

interface RethinkDBConfig extends RealtimeSearchConfig {
    connectionConfig: {
        host: string,
        port: number
    }
}

export class RethinkDBConnection implements DatabaseClient {
    private connection!: rethinkdb.Connection

    constructor (private config: RethinkDBConfig, private logger: StdLogger | PinoLogger) {
    }

    public async start (): Promise<void> {
        this.logger.info('Initializing MongoDB Connection')
        try {
          this.connection = await rethinkdb.connect(this.config.connectionConfig)
          this.connection.use(this.config.database)
          this.logger.info(`Connected successfully to rethinkdb database ${this.config.database}`)
        } catch (e) {
          this.logger.fatal('Error connecting to rethinkdb', e)
        }
    }

    public getSearch (logger: StdLogger | PinoLogger, database: string, query: Query, callbacks: RealtimeSearchCallbacks): any {
      this.logger.info('get search');
      return new RethinkDBSearch(logger, database, query, callbacks, this.connection, this.config.primaryKey, this.config.excludeTablePrefix)
    }

    public async stop (): Promise<void> {
        await this.connection.close()
    }
}
