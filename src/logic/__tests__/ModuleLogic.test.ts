import { describe, it, expect } from 'vitest';
import { ModuleLogic } from '../ModuleLogic';

describe('ModuleLogic ciphers', () => {
    it('encodes morse with symbols', () => {
        const encoded = ModuleLogic.morseWithSymbols('SOS');
        expect(encoded).toBe('... --- ...');
    });

    it('encodes and decodes Vigenère', () => {
        const key = 'SCOUT';
        const plain = 'BONJOUR';
        const cipher = ModuleLogic.vigenere(plain, key, false);
        expect(cipher).not.toBe(plain);
        const decrypted = ModuleLogic.vigenere(cipher, key, true);
        expect(decrypted.toUpperCase()).toBe(plain);
    });

    it('encodes avocat (A=K / Caesar +10)', () => {
        const encoded = ModuleLogic.avocat('ABC');
        expect(encoded.toLowerCase()).toBe('klm');
    });

    it('encodes cassis (K=6)', () => {
        const encoded = ModuleLogic.cassis('A');
        expect(encoded).toBeDefined();
    });

    it('encodes polybe', () => {
        const encoded = ModuleLogic.polybe('A');
        expect(encoded).toBe('11');
    });

    it('generic encode fallback returns unchanged text for clear text', () => {
        const text = 'Marchez 100m';
        const result = ModuleLogic.encode('texte_clair', text);
        expect(result).toBe(text);
    });
});
