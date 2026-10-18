import { test } from 'node:test';
import assert from 'node:assert/strict';
import { originFromApiUrl, resolveAssetUrl } from '../src/lib/assetUrl.ts';

test('originFromApiUrl strips trailing /api', () => {
    assert.equal(originFromApiUrl('https://api.x.com/api'), 'https://api.x.com');
    assert.equal(originFromApiUrl('https://api.x.com/api/'), 'https://api.x.com');
    assert.equal(originFromApiUrl('/api'), '');
    assert.equal(originFromApiUrl(undefined), '');
});

test('resolveAssetUrl prefixes relative upload paths', () => {
    assert.equal(resolveAssetUrl('/uploads/photos/a.jpg', 'https://api.x.com'), 'https://api.x.com/uploads/photos/a.jpg');
    assert.equal(resolveAssetUrl('uploads/a.pdf', 'https://api.x.com'), 'https://api.x.com/uploads/a.pdf');
    assert.equal(resolveAssetUrl('/uploads/a.jpg', ''), '/uploads/a.jpg');
});

test('resolveAssetUrl leaves absolute and falsy values unchanged', () => {
    assert.equal(resolveAssetUrl('https://cdn.x.com/a.jpg', 'https://api.x.com'), 'https://cdn.x.com/a.jpg');
    assert.equal(resolveAssetUrl('blob:abc', 'https://api.x.com'), 'blob:abc');
    assert.equal(resolveAssetUrl('data:image/png;base64,AA', 'https://api.x.com'), 'data:image/png;base64,AA');
    assert.equal(resolveAssetUrl('//cdn.x.com/a.jpg', 'https://api.x.com'), '//cdn.x.com/a.jpg');
    assert.equal(resolveAssetUrl(null, 'https://api.x.com'), null);
    assert.equal(resolveAssetUrl('', 'https://api.x.com'), '');
    assert.equal(resolveAssetUrl(undefined), undefined);
});
