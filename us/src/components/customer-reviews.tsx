"use client";

import { useEffect, useState } from "react";

const justdialUrl = "https://www.justdial.com/Greater-Noida/Beiman-Services-Opposite-Raja-Dhaba-Amritpuram-Jagat-Farm/011PXX11-XX11-231017000716-U5E7_BZDET";

type Review = { id: string; author_display: string; review_text: string; rating: number | null; kind: "review" | "highlight"; source: string };

const sharedJustdialReviews: Review[] = [
  { id: "jd-review-avnish", author_display: "Avnish Verma", review_text: "Very good experience.", rating: 5, kind: "review", source: "Justdial · BEIMAN SERVICES" },
  { id: "jd-review-vishal", author_display: "Vishal Rajput", review_text: "Best product and good service provided by the owner.", rating: 5, kind: "review", source: "Justdial · BEIMAN SERVICES" },
  { id: "jd-review-customer", author_display: "Justdial customer", review_text: "Very good. Good price.", rating: 5, kind: "review", source: "Justdial · BEIMAN SERVICES" },
  { id: "jd-review-shainki", author_display: "Shainki Gautam", review_text: "Good product, good price 👌", rating: 5, kind: "review", source: "Justdial · BEIMAN SERVICES" },
  { id: "jd-review-kalicharan", author_display: "Kalicharan Kushwaha", review_text: "Shared a 5-star rating on Justdial.", rating: 5, kind: "review", source: "Justdial · BEIMAN SERVICES" },
  { id: "jd-highlight-mechanic", author_display: "What customers liked", review_text: "Skilled mechanic and top-notch service.", rating: null, kind: "highlight", source: "Justdial review highlights" },
  { id: "jd-highlight-choice", author_display: "What customers liked", review_text: "A useful selection of mobile repair accessories and second-hand laptops.", rating: null, kind: "highlight", source: "Justdial review highlights" },
  { id: "jd-highlight-staff", author_display: "What customers liked", review_text: "Respectful staff and a welcoming customer experience.", rating: null, kind: "highlight", source: "Justdial review highlights" },
  { id: "jd-highlight-resolve", author_display: "What customers liked", review_text: "Kind service, with no charge until the issue was resolved.", rating: null, kind: "highlight", source: "Justdial review highlights" },
  { id: "jd-highlight-team", author_display: "What customers liked", review_text: "Friendly people and technical staff focused on resolving the issue.", rating: null, kind: "highlight", source: "Justdial review highlights" },
];

type DatabaseReview = { id: string; author_display: string; review_text: string; rating: number; journey: string | null };

function ReviewGroup({ reviews, duplicate = false }: { reviews: Review[]; duplicate?: boolean }) {
  return <div className="review-group" aria-hidden={duplicate || undefined}>{reviews.map((review) => <article className={`review-card ${review.kind === "highlight" ? "review-card-highlight" : ""}`} key={review.id}>
    {review.rating !== null ? <div className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div> : <span className="review-card-kicker">CUSTOMER HIGHLIGHT</span>}
    <p>{review.review_text}</p>
    <div className="review-author"><span className="review-avatar" aria-hidden="true">{review.author_display.trim().slice(0, 1).toUpperCase()}</span><span><strong>{review.author_display}</strong><small>{review.source}</small></span></div>
  </article>)}</div>;
}

export function CustomerReviews() {
  const [databaseReviews, setDatabaseReviews] = useState<Review[]>([]);
  useEffect(() => {
    let active = true;
    fetch("/api/v1/reviews", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Reviews unavailable");
      const body = await response.json() as { data: DatabaseReview[] };
      if (active) setDatabaseReviews((body.data ?? []).map((review) => ({ id: `rephon-${review.id}`, author_display: review.author_display, review_text: review.review_text, rating: review.rating, kind: "review" as const, source: `${review.journey ? `${review.journey} · ` : ""}REPHON 24X7` })));
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const reviews = [...sharedJustdialReviews, ...databaseReviews];
  return <section className="reviews-section" aria-labelledby="reviews-title">
    <div className="reviews-heading"><p className="eyebrow">CUSTOMER EXPERIENCE</p><h2 id="reviews-title">Experiences from our customers.</h2><p>Justdial reviews and customer highlights for BEIMAN SERVICES, REPHON 24X7’s offline shop.</p></div>
    <div className="review-viewport" aria-label="Auto-scrolling customer reviews"><div className="review-track"><ReviewGroup reviews={reviews} /><ReviewGroup reviews={reviews} duplicate /></div></div>
    <a className="justdial-rating-card" href={justdialUrl} target="_blank" rel="noreferrer" aria-label="View BEIMAN SERVICES on Justdial, rated 4.9 out of 5 with 1.9 thousand ratings">
      <span className="justdial-rating-mark" aria-hidden="true">JD</span>
      <span className="justdial-rating-copy"><small>BEIMAN SERVICES · REPHON OFFLINE SHOP</small><strong>Justdial customer rating</strong></span>
      <span className="justdial-rating-score"><strong>4.9<span>/5</span></strong><span className="justdial-rating-stars" aria-label="4.9 out of 5 stars">★★★★★</span></span>
      <span className="justdial-rating-count"><strong>1.9k</strong><small>user ratings</small></span>
      <span className="justdial-rating-link">View on Justdial</span>
    </a>
  </section>;
}
