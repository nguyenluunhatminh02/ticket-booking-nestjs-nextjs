import { registerDecorator, ValidationOptions } from 'class-validator';

const UUID_LIKE_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function IsUuidLike(validationOptions?: ValidationOptions): PropertyDecorator {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isUuidLike',
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} must be a UUID`, ...validationOptions },
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && UUID_LIKE_REGEX.test(value);
        },
      },
    });
  };
}

export function IsUuidLikeArray(validationOptions?: ValidationOptions): PropertyDecorator {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isUuidLikeArray',
      target: object.constructor,
      propertyName,
      options: { message: `each value in ${propertyName} must be a UUID`, ...validationOptions },
      validator: {
        validate(value: unknown) {
          return Array.isArray(value) && value.every((v) => typeof v === 'string' && UUID_LIKE_REGEX.test(v));
        },
      },
    });
  };
}
