import { Errors } from '../utils/ApiError.js';

export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message.replace(/"/g, "'"),
      }));
      return next(Errors.validation('Validation failed', details));
    }
    req[source] = value;
    next();
  };
}

export const validators = {
  email: (value, helpers) => {
    if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return helpers.error('any.invalid', { message: 'Invalid email address' });
    }
    return value;
  },
  pan: (value, helpers) => {
    if (value && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(value).toUpperCase())) {
      return helpers.error('any.invalid', { message: 'Invalid PAN format (e.g. ABCDE1234F)' });
    }
    return value;
  },
  aadhaar: (value, helpers) => {
    if (value && !/^\d{12}$/.test(String(value).replace(/\s/g, ''))) {
      return helpers.error('any.invalid', { message: 'Aadhaar must be 12 digits' });
    }
    return value;
  },
  ifsc: (value, helpers) => {
    if (value && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(value).toUpperCase())) {
      return helpers.error('any.invalid', { message: 'Invalid IFSC code' });
    }
    return value;
  },
  phone: (value, helpers) => {
    if (value && !/^[+]?[0-9\s-]{7,20}$/.test(String(value))) {
      return helpers.error('any.invalid', { message: 'Invalid phone number' });
    }
    return value;
  },
};