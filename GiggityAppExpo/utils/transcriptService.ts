import { saveTranscriptedJson, listTranscriptedFiles, loadTranscriptedJson } from './jsonLoader';
import * as FileSystem from 'expo-file-system';

// Interface for transcripted tasks
export interface TranscriptedTask {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
  source?: string;
}

/**
 * Add a new transcripted task to the Task folder
 * @param text The task text
 * @param source Optional source of the task (e.g., "Voice transcription")
 */
export const addTranscriptedTask = async (text: string, source?: string): Promise<TranscriptedTask> => {
  try {
    // Create a new task object
    const newTask: TranscriptedTask = {
      id: `task_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      text,
      done: false,
      createdAt: new Date().toISOString(),
      source
    };
    
    // Get the current date to use as part of the filename
    const today = new Date();
    const fileName = `tasks_${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}.json`;
    
    // Try to load an existing file for today if it exists
    try {
      const files = await listTranscriptedFiles('Task');
      
      if (files.includes(fileName)) {
        // If today's file exists, load it and append the new task
        const existingTasks = await loadTranscriptedJson<TranscriptedTask[]>('Task', fileName);
        
        // Add the new task
        existingTasks.push(newTask);
        
        // Save back to the file
        await saveTranscriptedJson('Task', fileName, existingTasks);
      } else {
        // If today's file doesn't exist, create a new one with just this task
        await saveTranscriptedJson('Task', fileName, [newTask]);
      }
    } catch (error) {
      // If there's an error, create a new file with just this task
      await saveTranscriptedJson('Task', fileName, [newTask]);
    }
    
    return newTask;
  } catch (error) {
    console.error('Error adding transcripted task:', error);
    throw error;
  }
};

/**
 * Get all transcripted tasks from all files
 */
export const getAllTranscriptedTasks = async (): Promise<TranscriptedTask[]> => {
  try {
    const files = await listTranscriptedFiles('Task');
    const allTasks: TranscriptedTask[] = [];
    
    for (const file of files) {
      try {
        const tasks = await loadTranscriptedJson<TranscriptedTask[]>('Task', file);
        
        if (Array.isArray(tasks)) {
          allTasks.push(...tasks);
        }
      } catch (err) {
        console.error(`Error loading ${file}:`, err);
      }
    }
    
    // Sort tasks by creation date, newest first
    allTasks.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    return allTasks;
  } catch (error) {
    console.error('Error getting all transcripted tasks:', error);
    return [];
  }
}; 