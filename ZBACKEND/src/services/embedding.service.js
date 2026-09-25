import OpenAI from "openai";

const getOpenAIClient = () => {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY in .env");
    }
    return new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });
};

/**
 * Deterministic hash-like function to generate a predictable vector
 * from text for the mock embedding provider.
 */
const generateMockEmbedding = (text) => {
    const vector = new Array(1536).fill(0);
    // Simple deterministic distribution
    let seed = 0;
    for (let i = 0; i < text.length; i++) {
        seed = (seed + text.charCodeAt(i)) % 1536;
        vector[seed] = (vector[seed] + 0.1) % 1.0;
    }
    // Normalize mock vector (approximate)
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
        for (let i = 0; i < vector.length; i++) {
            vector[i] /= magnitude;
        }
    }
    return vector;
};

/**
 * Generates an embedding vector for a single piece of text.
 * @param {string} text
 * @returns {Promise<number[]>} Array of floats (1536 dimensions for text-embedding-3-small)
 */
export const generateEmbedding = async (text) => {
    const provider = process.env.EMBEDDING_PROVIDER || "openai";

    if (provider === "mock") {
        return generateMockEmbedding(text);
    }

    const client = getOpenAIClient();
    const response = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: text
    });

    return response.data[0].embedding;
};

/**
 * Generates embedding vectors for an array of texts.
 * @param {string[]} texts
 * @returns {Promise<number[][]>} Array of vectors
 */
export const generateEmbeddings = async (texts) => {
    const provider = process.env.EMBEDDING_PROVIDER || "openai";

    if (provider === "mock") {
        return texts.map(generateMockEmbedding);
    }

    const client = getOpenAIClient();
    const response = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: texts
    });

    return response.data.map(item => item.embedding);
};
