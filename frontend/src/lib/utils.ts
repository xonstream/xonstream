import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert a string to a URL-friendly slug
 * Example: "Hello World! Test" -> "hello-world-test"
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-');        // Replace multiple - with single -
}

/**
 * Generate video URL path from post ID and title
 * Creates clean, SEO-friendly URLs
 * Example: { id: 'sync-1775299225650-ibakh9', title: 'My Video' } -> '/video/my-video'
 */
export function generateVideoUrl(postId: string, title: string): string {
  const slug = slugify(title);
  // Use short ID (last 8 chars) for uniqueness but keep URL clean
  const shortId = postId.slice(-8);
  return `/video/${slug}-${shortId}`;
}

/**
 * Extract post ID from video URL slug
 * Handles both full ID and short ID formats
 * Example: "/video/my-video-ibakh9" -> needs to match with full ID ending in "ibakh9"
 */
export function extractPostIdFromSlug(slug: string): string | null {
  // Slug format: title-shortid (last 8 chars of full ID)
  const lastDashIndex = slug.lastIndexOf('-');
  if (lastDashIndex === -1) return null;
  return slug.substring(lastDashIndex + 1);
}

/**
 * Format ISO date string to human-readable format
 * Example: "2026-04-19T16:13:50.401413+00:00" -> "Apr 19, 2026"
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) return '';
    
    // Format as "Apr 19, 2026"
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}
