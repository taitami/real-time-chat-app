import dotenv from 'dotenv';
import path from "path";
import { fileURLToPath } from "url";
import { TranslationServiceClient } from '@google-cloud/translate'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.PORT) { 
    dotenv.config({ path: path.join(__dirname, '../../.env') });
}

const translationClient = new TranslationServiceClient();

export const proxyToGoogleTranslate = async (req, res) => {
    const { textToTranslate, targetLanguage, sourceLanguage } = req.body;

    if (!textToTranslate || !targetLanguage) {
        return res.status(400).json({ message: "textToTranslate and targetLanguage are required in the request body" });
    }

    const projectId = process.env.GCP_PROJECT_ID;
    if (!projectId) {
        console.error("GCP_PROJECT_ID is not set in .env!");
        return res.status(500).json({ message: "Proxy configuration error: GCP Project ID missing" });
    }

    const location = 'global';

    const request = {
        parent: `projects/${projectId}/locations/${location}`,
        contents: [textToTranslate], 
        mimeType: 'text/plain', 
        sourceLanguageCode: sourceLanguage || null, 
        targetLanguageCode: targetLanguage,
    };

    try {
        console.log(`Proxying translation request to Google Cloud for target: ${targetLanguage}`);
        const [response] = await translationClient.translateText(request);

        if (response.translations && response.translations.length > 0) {
            const translatedText = response.translations[0].translatedText;
            res.json({ translatedText });
        } else {
            console.error("Google Translation API returned an empty or invalid response:", response);
            res.status(500).json({ message: "Failed to get translation from Google Cloud: Unexpected response format" });
        }
    } catch (error) {
        console.error("Error proxying to Google Cloud Translation service:", error.message);
        let statusCode = 500;
        let errorMessage = "Failed to connect to Google Cloud Translation service";

        if (error.code) {
            switch (error.code) {
                case 3: statusCode = 400; errorMessage = error.details || "Invalid argument for translation."; break;
                case 5: statusCode = 404; errorMessage = error.details || "Translation resource not found."; break;
                case 7: statusCode = 403; errorMessage = error.details || "Permission denied for translation service."; break;
                case 16: statusCode = 401; errorMessage = error.details || "Authentication failed for translation service."; break;
            }
        }
        res.status(statusCode).json({ message: errorMessage, details: error.details || error.message });
    }
};