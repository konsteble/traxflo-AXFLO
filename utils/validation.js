const { body } = require('express-validator');

module.exports = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ max: 100 }).withMessage('Max 100 characters'),
    
  body('artist')
    .trim()
    .notEmpty().withMessage('Artist is required')
    .isLength({ max: 100 }).withMessage('Max 100 characters'),
    
  (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }
    next();
  }
];