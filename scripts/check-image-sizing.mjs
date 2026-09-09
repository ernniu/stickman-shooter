#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const SOURCE_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
]);
const SIZING_HELPERS = new Set(['containImage', 'coverImage']);
const NATIVE_SIZE_HELPER = 'useNativeImageSize';

const sourceRoot = path.resolve(process.argv[2] ?? 'src');

const collectSourceFiles = async (directory) => {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(entryPath));
      continue;
    }
    if (
      entry.isFile() &&
      !entry.name.endsWith('.d.ts') &&
      SOURCE_EXTENSIONS.has(path.extname(entry.name))
    ) {
      files.push(entryPath);
    }
  }
  return files;
};

const callName = (expression) => {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }
  return undefined;
};

const imageFactoryName = (node) => {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
    return undefined;
  }
  const factoryName = node.expression.name.text;
  if (factoryName !== 'image' && factoryName !== 'sprite') {
    return undefined;
  }
  const addAccess = node.expression.expression;
  if (!ts.isPropertyAccessExpression(addAccess) || addAccess.name.text !== 'add') {
    return undefined;
  }
  return factoryName;
};

const nativeExceptionIsValid = (call, createdObject) => {
  if (call.arguments[0] !== createdObject || call.arguments.length < 2) {
    return false;
  }
  const reason = call.arguments[1];
  return (
    (ts.isStringLiteral(reason) || ts.isNoSubstitutionTemplateLiteral(reason)) &&
    reason.text.trim().length > 0
  );
};

const sizingDisposition = (creation) => {
  let current = creation;

  while (current.parent) {
    const parent = current.parent;

    if (
      ts.isPropertyAccessExpression(parent) &&
      parent.expression === current &&
      ts.isCallExpression(parent.parent) &&
      parent.parent.expression === parent
    ) {
      if (parent.name.text === 'setDisplaySize') {
        return 'sized';
      }
      current = parent.parent;
      continue;
    }

    if (ts.isCallExpression(parent) && parent.arguments.includes(current)) {
      const helperName = callName(parent.expression);
      if (SIZING_HELPERS.has(helperName)) {
        return parent.arguments[0] === current ? 'sized' : 'invalid-helper';
      }
      if (helperName === NATIVE_SIZE_HELPER) {
        return nativeExceptionIsValid(parent, current)
          ? 'native'
          : 'invalid-native';
      }
    }

    break;
  }

  return 'unsized';
};

const inspectFile = async (filePath) => {
  const sourceText = await readFile(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );
  const failures = [];

  const visit = (node) => {
    const factoryName = imageFactoryName(node);
    if (factoryName) {
      const disposition = sizingDisposition(node);
      if (disposition !== 'sized' && disposition !== 'native') {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        const detail = disposition === 'invalid-native'
          ? 'useNativeImageSize requires the created object as its first argument and a non-empty literal justification'
          : disposition === 'invalid-helper'
            ? 'the created object must be the first containImage/coverImage argument'
            : `add.${factoryName}(...) must be sized in the same expression`;
        failures.push(
          `${path.relative(process.cwd(), filePath)}:${line + 1}:${character + 1} ${detail}`,
        );
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return failures;
};

const files = await collectSourceFiles(sourceRoot);
const failures = (await Promise.all(files.map(inspectFile))).flat();

if (failures.length > 0) {
  process.stderr.write([
    'Image sizing validation failed:',
    ...failures.map((failure) => `- ${failure}`),
    '',
    'Use .setDisplaySize(...), containImage(...), or coverImage(...) in the creation expression.',
    'Use useNativeImageSize(object, "reason") only when native texture dimensions are intentional.',
    '',
  ].join('\n'));
  process.exitCode = 1;
} else {
  process.stdout.write(`Image sizing validation passed (${files.length} source files).\n`);
}
