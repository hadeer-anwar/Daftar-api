import { Types } from 'mongoose';

import { TransactionType } from '../../transactions/schemas/transactions.schema';
import { RecurringTransactionsRepository } from './recurring-transactions.repository';

describe('RecurringTransactionsRepository.findByUserId', () => {
  const userId = new Types.ObjectId();

  const setup = () => {
    const query = {
      sort: jest.fn().mockResolvedValue([]),
    };
    const model = {
      find: jest.fn().mockReturnValue(query),
    };
    const repository = new RecurringTransactionsRepository(model as never);

    return { repository, model, query };
  };

  it('returns all the user rules when filters are omitted', async () => {
    const { repository, model, query } = setup();

    await repository.findByUserId(userId.toString());

    expect(model.find).toHaveBeenCalledWith({ userId });
    expect(query.sort).toHaveBeenCalledWith({ nextRunDate: 1 });
  });

  it('applies type and active filters together in the database query', async () => {
    const { repository, model } = setup();

    await repository.findByUserId(userId.toString(), {
      type: TransactionType.EXPENSE,
      isActive: false,
    });

    expect(model.find).toHaveBeenCalledWith({
      userId,
      type: TransactionType.EXPENSE,
      isActive: false,
    });
  });
});
