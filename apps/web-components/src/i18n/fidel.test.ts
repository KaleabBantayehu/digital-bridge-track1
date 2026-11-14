import { describe, expect, it } from 'vitest';
import { fidelOrders, toFidel } from './fidel';

describe('toFidel (Latin -> Fidel typing helper)', () => {
  it('uses the common spelling for well-known names and places', () => {
    expect(toFidel('abebe')).toBe('አበበ');
    expect(toFidel('kebede')).toBe('ከበደ');
    expect(toFidel('selam')).toBe('ሰላም');
    expect(toFidel('chaltu')).toBe('ጫልቱ');
    expect(toFidel('tigist')).toBe('ትዕግስት');
    expect(toFidel('Addis Ababa')).toBe('አዲስ አበባ');
  });

  it('applies consonant + vowel rules to other words', () => {
    expect(toFidel('beso')).toBe('በሶ');
    expect(toFidel('mekina')).toBe('መኪና');
    expect(toFidel('shai')).toBe('ሻኢ');
    expect(toFidel('ketema')).toBe('ከተማ');
  });

  it('keeps digits, spaces and punctuation', () => {
    expect(toFidel('kebele 03')).toBe('ቀበሌ 03');
  });
});

describe('fidelOrders', () => {
  it('returns the seven forms of a letter series', () => {
    expect(fidelOrders('በ')).toEqual(['በ', 'ቡ', 'ቢ', 'ባ', 'ቤ', 'ብ', 'ቦ']);
    expect(fidelOrders('ቦ')).toEqual(['በ', 'ቡ', 'ቢ', 'ባ', 'ቤ', 'ብ', 'ቦ']);
  });

  it('returns nothing for non-Ethiopic characters', () => {
    expect(fidelOrders('a')).toEqual([]);
  });
});
