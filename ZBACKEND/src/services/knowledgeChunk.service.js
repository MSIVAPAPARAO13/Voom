/**
 * Knowledge Chunk Service
 * Provides helper functions to segment transcripts into logical RAG chunks.
 */

const KNOWLEDGE_CHUNK_MAX_LENGTH = process.env.KNOWLEDGE_CHUNK_MAX_LENGTH ? parseInt(process.env.KNOWLEDGE_CHUNK_MAX_LENGTH, 10) : 1000;
const KNOWLEDGE_CHUNK_OVERLAP = process.env.KNOWLEDGE_CHUNK_OVERLAP ? parseInt(process.env.KNOWLEDGE_CHUNK_OVERLAP, 10) : 200;

/**
 * Converts transcript segments into overlapping knowledge chunks.
 *
 * @param {Array} segments - Array of { start, end, text, speaker }
 * @returns {Array} Array of { text, startTime, endTime, sourceId }
 */
export const chunkTranscript = (segments) => {
    if (!segments || segments.length === 0) return [];

    const chunks = [];
    let currentChunkText = "";
    let currentChunkStart = null;
    let currentChunkEnd = null;
    let chunkIndex = 0;

    // Buffer to keep track of recent segments for overlap
    const recentSegments = [];

    for (const segment of segments) {
        recentSegments.push(segment);

        if (currentChunkStart === null) {
            currentChunkStart = segment.start;
        }

        const segmentText = segment.speaker ? `${segment.speaker}: ${segment.text}` : segment.text;
        
        if (currentChunkText.length + segmentText.length > KNOWLEDGE_CHUNK_MAX_LENGTH && currentChunkText.length > 0) {
            // Push completed chunk
            chunks.push({
                text: currentChunkText.trim(),
                startTime: currentChunkStart,
                endTime: currentChunkEnd,
                sourceId: `transcript_chunk_${chunkIndex++}`
            });

            // Start new chunk with overlap
            currentChunkText = "";
            currentChunkStart = null;
            let overlapLength = 0;
            
            // Re-add segments backwards until we hit our desired overlap length
            for (let i = recentSegments.length - 1; i >= 0; i--) {
                const rs = recentSegments[i];
                const rsText = rs.speaker ? `${rs.speaker}: ${rs.text}` : rs.text;
                
                if (overlapLength + rsText.length > KNOWLEDGE_CHUNK_OVERLAP && overlapLength > 0) {
                    break;
                }
                
                currentChunkText = `${rsText} ${currentChunkText}`;
                overlapLength += rsText.length + 1;
                currentChunkStart = rs.start; // The start of the overlap is the start of the earliest overlapped segment
            }
            
            // Add the current segment that triggered the break
            currentChunkText = `${currentChunkText} ${segmentText}`.trim();
            currentChunkEnd = segment.end;
        } else {
            // Keep appending to current chunk
            currentChunkText = currentChunkText ? `${currentChunkText} ${segmentText}` : segmentText;
            currentChunkEnd = segment.end;
        }

        // Keep recentSegments buffer small (just enough for overlap)
        if (recentSegments.length > 20) {
            recentSegments.shift();
        }
    }

    // Push the final chunk if it has content
    if (currentChunkText.trim().length > 0) {
        chunks.push({
            text: currentChunkText.trim(),
            startTime: currentChunkStart,
            endTime: currentChunkEnd,
            sourceId: `transcript_chunk_${chunkIndex++}`
        });
    }

    return chunks;
};
