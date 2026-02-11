import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@bim-audit/db';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    (
      this as PrismaClient & { $on(event: string, callback: () => void): void }
    ).$on('beforeExit', async () => {
      await app.close();
    });
  }
}
