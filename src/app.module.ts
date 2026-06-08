import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { MailModule } from './modules/mail/mail.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { RecurringTransactionsModule } from './modules/recurring-transactions/recurring-transactions.module';
import { ContentModule } from './modules/content/content.module';
import { CloudinaryModule } from './modules/cloudinary/cloudinary.module';
import { StatisticsModule } from './modules/statistics/statistics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
      }),
    }),
    UsersModule,
    AuthModule,
    MailModule,
    CategoriesModule,
    TransactionsModule,
    RecurringTransactionsModule,
    ContentModule,
    CloudinaryModule,
    StatisticsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
