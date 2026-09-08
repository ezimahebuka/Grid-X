import { NextFunction, Request, Response } from "express";
import { AnyZodObject, ZodError, ZodTypeAny } from "zod";

/**
 * Wraps req.body/params/query in a single zod schema, e.g.:
 *
 * const registerSchema = z.object({ body: z.object({ phone: z.string() }) });
 * router.post('/register', validate(registerSchema), asyncHandler(register));
 */
export function validate(schema: AnyZodObject | ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({ body: req.body, params: req.params, query: req.query });
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          errors: err.flatten().fieldErrors,
        });
      }
      next(err);
    }
  };
}
