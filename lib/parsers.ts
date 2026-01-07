
import { ParsedRule } from '../types';

export const parseCiscoASA = (text: string): ParsedRule[] => {
  const rules: ParsedRule[] = [];
  // access-list NAME extended {permit|deny} protocol source source-mask [dest dest-mask] [eq port]
  const regex = /access-list\s+(\S+)\s+extended\s+(permit|deny)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+eq\s+(\S+))?/gi;
  let match;
  let id = 1;

  while ((match = regex.exec(text)) !== null) {
    rules.push({
      id: id++,
      name: match[1],
      action: match[2].toLowerCase() as any,
      protocol: match[3],
      source: match[4] === 'any' ? '0.0.0.0/0' : `${match[4]} ${match[5]}`,
      destination: match[6] === 'any' ? '0.0.0.0/0' : `${match[6]} ${match[7]}`,
      port: match[8] || 'any',
      raw: match[0]
    });
  }
  return rules;
};

export const parsePaloAltoSet = (text: string): ParsedRule[] => {
  const rules: ParsedRule[] = [];
  // set rulebase security rules NAME source SRC destination DEST service SVC action allow
  const regex = /set\s+rulebase\s+security\s+rules\s+(\S+)\s+source\s+\[?\s*(\S+)\s*\]?\s+destination\s+\[?\s*(\S+)\s*\]?\s+service\s+\[?\s*(\S+)\s*\]?\s+action\s+(\S+)/gi;
  let match;
  let id = 1;

  while ((match = regex.exec(text)) !== null) {
    rules.push({
      id: id++,
      name: match[1],
      action: match[5].toLowerCase() as any,
      protocol: 'any', // Service usually implies protocol in PA
      source: match[2],
      destination: match[3],
      port: match[4],
      raw: match[0]
    });
  }
  return rules;
};

export const parseConfig = (vendor: string, text: string): ParsedRule[] => {
  switch (vendor) {
    case 'cisco': return parseCiscoASA(text);
    case 'paloalto': return parsePaloAltoSet(text);
    default: return [];
  }
};
