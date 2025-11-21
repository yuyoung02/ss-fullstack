import { API_BASE_URL } from "../apiConfig";

export async function fetchStayScore(address) {
  const res = await fetch(
    `${API_BASE_URL}/api/stay-score?address=${encodeURIComponent(address)}`
  );
  if (!res.ok) throw new Error("Stay Score API error");

  return await res.json();
}
