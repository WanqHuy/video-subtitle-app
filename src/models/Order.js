const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  userEmail: { 
    type: String, 
    required: true 
  },
  items: [
    {
      packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package' },
      name: String,
      price: Number,
      durationMinutes: Number,
      quantity: Number
    }
  ],
  total: { 
    type: Number, 
    required: true 
  },
  addedMinutes: { 
    type: Number, 
    default: 0 
  },
  status: { 
    type: String, 
    enum: ['Pending', 'Completed'], 
    default: 'Pending' 
  },
  paymentCode: { 
    type: String, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Order', orderSchema);