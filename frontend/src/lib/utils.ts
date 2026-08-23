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
 * Creates clean, SEO-friendly URLs with full postId for millisecond resolution
 * Example: { id: 'sync-1775299225650-ibakh9', title: 'My Video' } -> '/video/my-video--sync-1775299225650-ibakh9'
 */
export function generateVideoUrl(postId: string, title: string): string {
  const slug = slugify(title);
  return slug ? `/video/${slug}--${postId}` : `/video/${postId}`;
}

/**
 * Extract post ID from video URL slug
 * Handles double-dash, raw ID, and legacy single-dash formats
 */
export function extractPostIdFromSlug(slug: string): string {
  if (!slug) return '';
  if (slug.includes('--')) {
    return slug.split('--').pop() || slug;
  }
  if (/^[0-9a-f-]{36}$/i.test(slug) || slug.startsWith('sync-') || slug.startsWith('post-') || slug.startsWith('st-')) {
    return slug;
  }
  const lastDashIndex = slug.lastIndexOf('-');
  if (lastDashIndex !== -1) {
    return slug.substring(lastDashIndex + 1);
  }
  return slug;
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
