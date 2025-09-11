const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Use default local MongoDB if no environment variable is set
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sumbong';
    
    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
  } catch (error) {
    console.error('MongoDB connection error:');
    console.error('1. Make sure MongoDB is running locally on port 27017');
    console.error('2. Or set MONGODB_URI environment variable for Atlas connection');
    console.error('\nDetailed error:', error.message);
    
    // For development, don't exit the process, just log the error
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

module.exports = connectDB; 