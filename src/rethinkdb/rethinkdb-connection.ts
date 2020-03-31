import { DatabaseClient, RealtimeSearchConfig, RealtimeSearchCallbacks } from '../provider'
import * as rethinkdb from 'rethinkdb'
import { RethinkDBSearch } from './rethinkdb-search'
import { Query } from '../provider'
import { RealtimeSearch } from '../provider'
import { StdLogger } from '../logger/std-logger'
import { PinoLogger } from '../logger/pino-logger'
import { TableManager } from '@deepstream/storage-rethinkdb/src/table-manager';
import Table = WebAssembly.Table;

interface RethinkDBConfig extends RealtimeSearchConfig {
    connectionConfig: {
        host: string,
        port: number
    }
}

export class RethinkDBConnection implements DatabaseClient {
    private connection: rethinkdb
    private tableManager: TableManager

    constructor (private config: RethinkDBConfig, private logger: StdLogger | PinoLogger) {
    }

    public async start (): Promise<void> {
        this.logger.info('Initializing MongoDB Connection')
        try {
          this.connection = await rethinkdb.connect(this.config.connectionConfig)
          const dbList = await rethinkdb.dbList().run(this.connection)
          if (!dbList.includes(this.config.database)) {
            await rethinkdb.dbCreate(this.config.database).run(this.connection)
          }
          this.connection.use(this.config.database)
          this.tableManager = new TableManager(this.connection, this.config.database)
          await this.tableManager.refreshTables()
          this.logger.info(`Connected successfully to rethinkdb database ${this.config.database}`)
        } catch (e) {
          this.logger.fatal('Error connecting to rethinkdb', e)
        }
    }

    public getSearch (logger: StdLogger | PinoLogger, database: string, query: Query, callbacks: RealtimeSearchCallbacks): any {
      //return new RethinkDBSearch(logger, database, query, callbacks, this.mongoClient, this.config.primaryKey, this.config.excludeTablePrefix, this.config.nativeQuery)
    }

    public async stop (): Promise<void> {
        await this.connection.close()
    }
}
