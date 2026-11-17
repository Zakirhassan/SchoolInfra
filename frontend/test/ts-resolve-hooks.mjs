// Lets Node load the Worker's extensionless TypeScript imports (e.g. '../lib/auth') in tests.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.\w+$/.test(specifier)) {
      return nextResolve(specifier + '.ts', context);
    }
    throw err;
  }
}
