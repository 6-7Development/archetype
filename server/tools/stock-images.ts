/**
 * Stock image tool for Lomu AI
 * Fetch and download stock images
 */

import fs from 'fs/promises';
import path from 'path';
import https from 'https';

export interface StockImageResult {
  success: boolean;
  message: string;
  images: {
    url: string;
    savedPath?: string;
    width?: number;
    height?: number;
  }[];
  error?: string;
}

/**
 * Download file from URL
 */
async function downloadFile(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      const file = require('fs').createWriteStream(outputPath);
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (err: Error) => {
        fs.unlink(outputPath).catch(() => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

/**
 * Fetch stock images from Unsplash API or Pexels
 */
export async function stockImageTool(params: {
  description: string;
  limit?: number;
  orientation?: 'horizontal' | 'vertical' | 'all';
}): Promise<StockImageResult> {
  const {
    description,
    limit = 1,
    orientation = 'horizontal',
  } = params;
  
  try {
    // Validate parameters
    if (!description || description.trim().length === 0) {
      return {
        success: false,
        message: 'Description is required',
        images: [],
        error: 'Empty description provided',
      };
    }
    
    if (limit < 1 || limit > 10) {
      return {
        success: false,
        message: 'Limit must be between 1 and 10',
        images: [],
        error: 'Invalid limit',
      };
    }
    
    // Check for Unsplash API key
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    
    if (!unsplashKey) {
      // Return placeholder URLs if no API key
      const placeholderImages = Array.from({ length: limit }, (_, i) => ({
        url: `https://placehold.co/800x600/png?text=${encodeURIComponent(description)}+${i + 1}`,
        width: 800,
        height: 600,
      }));
      
      return {
        success: true,
        message: `Generated ${limit} placeholder image(s). Add UNSPLASH_ACCESS_KEY for real stock photos.`,
        images: placeholderImages,
      };
    }
    
    // Fetch from Unsplash API
    const query = encodeURIComponent(description);
    const orientationParam = orientation !== 'all' ? `&orientation=${orientation}` : '';
    const apiUrl = `https://api.unsplash.com/search/photos?query=${query}&per_page=${limit}${orientationParam}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Client-ID ${unsplashKey}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.statusText}`);
    }
    
    const data = await response.json() as { results?: Array<{ urls?: { regular?: string }; width?: number; height?: number }> };
    
    // ✅ Validate API response structure
    if (!data || !Array.isArray(data.results) || data.results.length === 0) {
      return {
        success: false,
        message: `No images found for "${description}"`,
        images: [],
        error: 'No results',
      };
    }
    
    // Download images to attached_assets/stock_images
    const stockImagesDir = path.join(process.cwd(), 'attached_assets', 'stock_images');
    
    try {
      await fs.mkdir(stockImagesDir, { recursive: true });
    } catch (mkdirError) {
      console.warn('[STOCK-IMAGE] Could not create directory:', mkdirError);
    }
    
    const images = await Promise.all(
      data.results.slice(0, limit).map(async (result, index: number) => {
        // ✅ Validate result structure before accessing properties
        if (!result?.urls?.regular) {
          console.warn('[STOCK-IMAGE] Skipping image with missing URL');
          return null;
        }
        
        const imageUrl = result.urls.regular;
        const fileName = `${description.replace(/\s+/g, '_')}_${Date.now()}_${index}.jpg`;
        const filePath = path.join(stockImagesDir, fileName);
        
        try {
          await downloadFile(imageUrl, filePath);
          return {
            url: imageUrl,
            savedPath: `attached_assets/stock_images/${fileName}`,
            width: result.width || 0,
            height: result.height || 0,
          };
        } catch (downloadError) {
          console.warn('[STOCK-IMAGE] Download failed for image:', downloadError);
          return {
            url: imageUrl,
            width: result.width || 0,
            height: result.height || 0,
          };
        }
      })
    ).then(results => results.filter(img => img !== null));
    
    return {
      success: true,
      message: `Found ${images.length} stock image(s) for "${description}"`,
      images,
    };
  } catch (error: any) {
    console.error('[STOCK-IMAGE-TOOL] Error:', error);
    return {
      success: false,
      message: `Failed to fetch stock images: ${error.message}`,
      images: [],
      error: error.message,
    };
  }
}
