const { isAuth, isAdmin } = require("./auth");

/**
 * Router-level guard that requires an authenticated admin for any MUTATING
 * request (POST/PUT/PATCH/DELETE), while leaving GET (and any explicitly
 * exempted read-via-non-GET routes) public.
 *
 * Fixes the pre-existing gap where catalog-style routers (products, categories,
 * brands, pets, coupons, attributes) were mounted without isAuth/isAdmin,
 * leaving create/update/delete open to anyone.
 *
 * @param {object} [options]
 * @param {(method: string, path: string) => boolean} [options.isPublicRead]
 *   Returns true for non-GET routes that are actually reads and must stay public
 *   (e.g. products POST /:id getById, attributes PUT /show/test).
 */
function adminOnlyMutations(options = {}) {
  const isPublicRead = options.isPublicRead || (() => false);
  const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

  return (req, res, next) => {
    if (!MUTATING.has(req.method)) return next();
    if (isPublicRead(req.method, req.path)) return next();

    // Chain the existing middlewares; each sends its own error response on
    // failure and only calls the continuation on success.
    return isAuth(req, res, (err) => {
      if (err) return next(err);
      return isAdmin(req, res, next);
    });
  };
}

module.exports = { adminOnlyMutations };
