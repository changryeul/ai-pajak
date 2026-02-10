/**
 * SPT 1770 SS Module
 *
 * Indonesian simplified annual tax return for individual taxpayers
 */

export * from './types';
export * from './calculator';
export { SPT1770SSPDF, default as SPT1770SSPDFDocument } from './pdf-generator';
