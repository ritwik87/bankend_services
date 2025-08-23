import Joi from 'joi';

export const duprValidationSchema = Joi.object({
  duprId: Joi.string().required().min(1).max(50),
});

export const duprIdSchema = Joi.object({
  duprId: Joi.string().required().min(1).max(50),
});

export const emailLookupSchema = Joi.object({
  email: Joi.string().email().required(),
});

export const validateRequest = (schema: Joi.ObjectSchema, data: any) => {
  const { error, value } = schema.validate(data);
  if (error) {
    throw new Error(`Validation error: ${error.details[0].message}`);
  }
  return value;
};
