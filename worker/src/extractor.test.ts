import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SEED_GLOBAL_EXTRACT_RULES, matchGenericCode, matchWithRegex, extractLink } from './extractor';
import { reconstructRawEmail } from './database';

describe('extractLink', () => {
  it('extracts verification URLs from text', () => {
    const link = extractLink('Click https://example.com/verify?token=abc123 to confirm');
    assert.equal(link, 'https://example.com/verify?token=abc123');
  });

  it('extracts from href in html', () => {
    const link = extractLink(
      '',
      '<a href="https://service.com/confirm/email?id=1">Verify</a>'
    );
    assert.equal(link, 'https://service.com/confirm/email?id=1');
  });

  it('skips unsubscribe links', () => {
    const link = extractLink('https://example.com/unsubscribe?id=1');
    assert.equal(link, null);
  });
});

describe('reconstructRawEmail', () => {
  it('builds minimal RFC822 from fields', () => {
    const raw = reconstructRawEmail({
      fromAddress: 'noreply@test.com',
      fromName: 'Test',
      toAddress: 'user@temp.com',
      subject: 'Hello',
      textContent: 'Body text',
      receivedAt: 1710000000,
    });
    assert.ok(raw.includes('From: Test <noreply@test.com>'));
    assert.ok(raw.includes('Subject: Hello'));
    assert.ok(raw.includes('Body text'));
  });
});

describe('matchGenericCode', () => {
  it('extracts digits after English keywords', () => {
    assert.equal(matchGenericCode('Your verification code: 123456'), '123456');
    assert.equal(matchGenericCode('PIN: 9876'), '9876');
  });

  it('extracts digits after Chinese keyword', () => {
    assert.equal(matchGenericCode('验证码: 556677'), '556677');
  });

  it('extracts digits after Chinese 为/是 connectors', () => {
    assert.equal(matchGenericCode('验证码为：123456'), '123456');
    assert.equal(matchGenericCode('您的验证码是 654321'), '654321');
  });

  it('extracts standalone 6-digit code when subject hints verification', () => {
    assert.equal(
      matchGenericCode(
        'Hyperdown 验证码\n请使用以下验证码完成注册\n887766',
        '请使用以下验证码完成注册\n887766',
        'Hyperdown 验证码'
      ),
      '887766'
    );
  });

  it('returns null when no match', () => {
    assert.equal(matchGenericCode('Hello world'), null);
  });
});

describe('SEED_GLOBAL_EXTRACT_RULES', () => {
  it('defines default global rules for DB seeding', () => {
    assert.equal(SEED_GLOBAL_EXTRACT_RULES.length, 2);
    assert.ok(SEED_GLOBAL_EXTRACT_RULES.every((r) => r.domain === '*'));
    assert.ok(SEED_GLOBAL_EXTRACT_RULES[0].regex.includes('验证码'));
    assert.ok(SEED_GLOBAL_EXTRACT_RULES[1].remark.includes('6 位数字'));
  });
});

describe('matchWithRegex', () => {
  it('returns first capture group when present', () => {
    assert.equal(matchWithRegex('code is ABC-1234', 'code is ([A-Z0-9-]+)'), 'ABC-1234');
  });

  it('falls back to digit run in full match', () => {
    assert.equal(matchWithRegex('token 888888', 'token \\d+'), '888888');
  });

  it('returns null for invalid regex', () => {
    assert.equal(matchWithRegex('test', '[invalid'), null);
  });
});
