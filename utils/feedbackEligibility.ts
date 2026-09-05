import { TranscriptionItem } from '../types';

export const hasCandidateResponse = (transcripts: TranscriptionItem[]): boolean =>
  transcripts.some(item => item.speaker === 'user' && Boolean(item.text.trim()));