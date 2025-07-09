import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function extractDefaultFileName(url) {
  const segments = url.split('/');
  const filename = segments[segments.length - 1];
  return filename.split('.')[0] || 'Unknown Track';
}

export function trimFileName(filename, maxLength = 20) {
  if (filename.length <= maxLength) return filename;
  return filename.substring(0, maxLength - 3) + '...';
}

export function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function calculateWaitTimeMilliseconds(targetServerTime, offsetEstimate) {
  const now = Date.now();
  const serverNow = now + offsetEstimate;
  return Math.max(0, targetServerTime - serverNow);
}
