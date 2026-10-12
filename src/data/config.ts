import data from './character.json';
import type { CharacterConfig } from '../rules/types';

/** Static character configuration. Edit character.json to change it; it is never written at runtime. */
export const config: CharacterConfig = Object.freeze(data as CharacterConfig);
