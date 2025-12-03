const { supabase } = require("./supabaseClient");

function getStartOfTodayUTC() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

async function checkDailyLimit(userId, maxPerDay = 100) {
  if (!userId) {
    throw new Error("checkDailyLimit requires a userId");
  }

  const upperLimit =
    Number.isFinite(maxPerDay) && maxPerDay > 0 ? maxPerDay : Infinity;
  if (!Number.isFinite(upperLimit)) {
    return { allowed: true, remaining: Infinity };
  }

  const startOfToday = getStartOfTodayUTC().toISOString();

  const { error, count } = await supabase
    .from("ai_requests")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfToday);

  if (error) {
    throw new Error(`Failed to check daily limit: ${error.message}`);
  }

  const used = typeof count === "number" ? count : 0;

  if (used >= upperLimit) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: upperLimit - used };
}

module.exports = {
  checkDailyLimit,
};
