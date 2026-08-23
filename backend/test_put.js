const fastify = require('fastify')({ logger: false });
const env = require('./src/config/env');
const adminAuth = require('./src/middleware/adminAuth');
const cookie = require('@fastify/cookie');

async function testPutRoute() {
  await fastify.register(cookie, { secret: env.ADMIN_SECRET });
  await fastify.register(adminAuth);
  await fastify.register(require('./src/routes/admin'));
  await fastify.ready();

  const token = fastify.jwt.sign({ username: 'admin', role: 'admin' }, { expiresIn: '7d' });

  // Test payload with existing post
  const postId = 'a4bdeb0e-f029-46aa-ba34-e493b560ce8a';
  const payload = {
    title: '[Bratty Sis] Smart House Dumb Stepbro S42E3',
    thumbnail: 'https://thumb.tapecontent.net/thumb/8K2qOPrDajSGLq/thumb.jpg',
    description: 'Updated description test',
    channelId: '',
    channelName: 'Bratty Sis',
    categoryIds: [],
    actors: ['Bratty Sis'],
    videoSources: [{ platform: 'streamtape', videoId: '8K2qOPrDajSGLq' }]
  };

  console.log('Sending PUT /api/admin/posts/' + postId);
  const res = await fastify.inject({
    method: 'PUT',
    url: '/api/admin/posts/' + postId,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload)
  });

  console.log('Status code:', res.statusCode);
  console.log('Response body:', res.body);
}

testPutRoute().catch(err => console.error('Error during test:', err));
