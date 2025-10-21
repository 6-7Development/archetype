import { platformHealing } from '../platformHealing';

/**
 * Platform modification tools for Meta-SySop
 * Allow SySop to fix Archetype's own code via normal chat
 */

export async function executePlatformRead(params: { path: string }): Promise<string> {
  try {
    const content = await platformHealing.readPlatformFile(params.path);
    return content;
  } catch (error: any) {
    throw new Error(`Failed to read platform file: ${error.message}`);
  }
}

export async function executePlatformWrite(params: { path: string; content: string }): Promise<string> {
  try {
    await platformHealing.writePlatformFile(params.path, params.content);
    return `Successfully wrote to ${params.path}`;
  } catch (error: any) {
    throw new Error(`Failed to write platform file: ${error.message}`);
  }
}

export async function executePlatformList(params: { directory: string }): Promise<string[]> {
  try {
    const files = await platformHealing.listPlatformFiles(params.directory);
    return files;
  } catch (error: any) {
    throw new Error(`Failed to list platform files: ${error.message}`);
  }
}
