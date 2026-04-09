/**
 * Auth middleware factory.
 *
 * Usage:
 *   router.get('/some-route', requireAuth(['super_admin', 'admin']), handler)
 *
 * If the user is not logged in they are redirected to /login (with a `next`
 * query param so login can redirect back).  If they are logged in but their
 * role is not in the allowed list they get a 403.
 */

/**
 * @param {string[]} roles  Allowed roles, e.g. ['super_admin', 'admin']
 */
function requireAuth(roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      // Not logged in — redirect to login, remembering where they wanted to go
      const next_ = encodeURIComponent(req.originalUrl);
      return res.redirect(`/login?next=${next_}`);
    }

    if (!req.session.user.active) {
      req.session.destroy(() => {});
      return res.redirect("/login?error=deactivated");
    }

    if (roles && roles.length > 0 && !roles.includes(req.session.user.role)) {
      return res.status(403).render("error", {
        title: "Access denied",
        message: "You do not have permission to view this page.",
      });
    }

    // Expose user to all downstream handlers and EJS views
    res.locals.user = req.session.user;
    next();
  };
}

module.exports = { requireAuth };
