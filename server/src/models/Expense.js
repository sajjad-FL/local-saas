import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name, index: true });

export const EXPENSE_CATEGORIES = ['rent', 'salary', 'electricity', 'water', 'internet', 'maintenance', 'equipment', 'groceries', 'marketing', 'other'];

// money the owner spent running the business; profit = payments received − expenses
const expenseSchema = new Schema({
  businessId: ref('Business'),
  amount: { type: Number, required: true },
  category: { type: String, enum: EXPENSE_CATEGORIES, default: 'other' },
  label: { type: String, trim: true, maxlength: 40 }, // the owner's own name for an 'other' expense
  date: { type: Date, default: Date.now, index: true },
  note: String,
  createdBy: ref('User'),
});

export const Expense = model('Expense', expenseSchema);
export default Expense;
