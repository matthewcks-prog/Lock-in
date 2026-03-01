export type Echo360Info = {
  lessonId?: string;
  mediaId?: string;
  baseUrl: string;
};

/**
 * Echo360 syllabus API response types.
 */
export type Echo360SyllabusMedia = {
  id?: string;
  mediaId?: string;
  media_id?: string;
  mediaType?: string;
  title?: string;
  name?: string;
  isAvailable?: boolean;
  isHiddenDueToCaptions?: boolean;
  isProcessing?: boolean;
  isFailed?: boolean;
  isPreliminary?: boolean;
  isAudioOnly?: boolean;
  lessonId?: string;
  lesson_id?: string;
};

export type Echo360SyllabusLesson = {
  id?: string;
  lessonId?: string;
  lesson_id?: string;
  name?: string;
  displayName?: string;
  title?: string;
  timing?: {
    start?: string;
    end?: string;
  };
  isFolderLesson?: boolean;
};

export type Echo360SyllabusEntry = {
  lesson?:
    | Echo360SyllabusLesson
    | { lesson?: Echo360SyllabusLesson; medias?: Echo360SyllabusMedia[] };
  medias?: Echo360SyllabusMedia[];
  media?: Echo360SyllabusMedia | Echo360SyllabusMedia[];
};

export type Echo360SyllabusResponse = {
  status?: string;
  message?: string;
  data?: Echo360SyllabusEntry[];
};

export type UnknownRecord = Record<string, unknown>;
