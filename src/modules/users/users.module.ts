import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './repositories/users.repository';
import { User, UserSchema } from './schemas/user.schema';
import { MailModule } from '../mail/mail.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { RecurringTransactionsModule } from '../recurring-transactions/recurring-transactions.module';
import { TransactionsModule } from '../transactions/transactions.module';
@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
      },
    ]),
    MailModule,
    CloudinaryModule,
    forwardRef(() => TransactionsModule),
    forwardRef(() => RecurringTransactionsModule),
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersRepository],
})
export class UsersModule {}
