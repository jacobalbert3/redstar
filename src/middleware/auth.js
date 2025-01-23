const jwt = require('jsonwebtoken');

//req is the http request object, res is the http response object, and next is the next middleware function in the chain
const authenticateToken = (req, res, next) => {
  try {
    //retrieves the authorization header from the incoming http request
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      console.log('No token provided');
      return res.status(401).json({ error: 'No token provided' });
    }
    console.log('Token being verified:', token);
    //decodes and validates the token using the secret key stored in process
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { authenticateToken }; 