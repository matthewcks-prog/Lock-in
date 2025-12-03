const { supabase } = require("./supabaseClient");

async function requireSupabaseUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (!token) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      const info =
        error?.message || error?.name || "Unknown Supabase auth error";
      console.warn("Supabase token validation failed:", info);
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = data.user;
    next();
  } catch (error) {
    console.error("Supabase auth error:", error.message);
    res.status(500).json({ error: "Failed to authenticate user" });
  }
}

module.exports = {
  requireSupabaseUser,
};
