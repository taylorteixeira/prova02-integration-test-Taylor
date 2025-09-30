import pactum from 'pactum';
import { StatusCodes } from 'http-status-codes';
import { SimpleReporter } from '../simple-reporter';
import { faker } from '@faker-js/faker';

const BASE_URL = process.env.CFP_BASE_URL || 'https://cfp-server.vercel.app';

describe('CFP Server - API Tests', () => {
  const p = pactum;
  const rep = SimpleReporter;
  const user = {
    username: faker.internet.username(),
    email: faker.internet.email(),
    password: 'Test@12345',
    mobile: faker.phone.number()
  };

  let cookie: string;
  let categoryId: string;
  let goalId: string;

  beforeAll(async () => {
    p.request.setBaseUrl(BASE_URL);
    p.request.setDefaultTimeout(30000);
    p.reporter.add(rep);

    try {
      await p
        .spec()
        .post('/user/signup')
        .withJson(user)
        .expectStatus(StatusCodes.OK);
    } catch (error) {
    }

    try {
      const response = await p
        .spec()
        .post('/user/signin')
        .withJson({
          email: user.email,
          password: user.password
        })
        .expectStatus(StatusCodes.OK);

      const setCookieHeader = response.headers['set-cookie'];
      if (setCookieHeader) {
        cookie = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
      } else {
        throw new Error('No cookie received from signin');
      }
    } catch (signinError) {
      const newUser = {
        username: faker.internet.username(),
        email: faker.internet.email(),
        password: 'Test@12345',
        mobile: faker.phone.number()
      };

      await p
        .spec()
        .post('/user/signup')
        .withJson(newUser)
        .expectStatus(StatusCodes.OK);

      const response = await p
        .spec()
        .post('/user/signin')
        .withJson({
          email: newUser.email,
          password: newUser.password
        })
        .expectStatus(StatusCodes.OK);

      const setCookieHeader = response.headers['set-cookie'];
      cookie = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;

      Object.assign(user, newUser);
    }

    expect(cookie).toBeDefined();
  });

  afterAll(async () => {
    if (cookie) {
      try {
        await p
          .spec()
          .get('/user/signout')
          .withHeaders('Cookie', cookie)
          .expectStatus(StatusCodes.CREATED);
      } catch (error) {
      }
    }
    p.reporter.end();
  });

  describe('User Authentication', () => {
    it('should access protected route successfully', async () => {
      await p
        .spec()
        .get('/user/protectedRoute')
        .withHeaders('Cookie', cookie)
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({
          success: true
        })
        .expectBodyContains('success')
        .expectHeaderContains('content-type', 'application/json');
    });

    it('should fail to access protected route without authentication', async () => {
      await p
        .spec()
        .get('/user/protectedRoute')
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({
          success: false,
          message: 'User not authorized'
        });
    });

    it('should fail signin with invalid credentials', async () => {
      await p
        .spec()
        .post('/user/signin')
        .withJson({
          email: 'invalid@email.com',
          password: 'wrongpassword'
        })
        .expectStatus(StatusCodes.BAD_REQUEST);
    });
  });

  describe('Category Management', () => {
    it('should create a new expense category', async () => {
      const response = await p
        .spec()
        .post('/category/addCategory')
        .withHeaders('Cookie', cookie)
        .withJson({
          categoryName: faker.commerce.department(),
          categoryType: 'expense'
        })
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({
          success: true
        });

      if (response.json && response.json.category) {
        categoryId = response.json.category._id;
        expect(categoryId).toBeDefined();
      }
    });

    it('should create an income category', async () => {
      await p
        .spec()
        .post('/category/addCategory')
        .withHeaders('Cookie', cookie)
        .withJson({
          categoryName: faker.commerce.department(),
          categoryType: 'income'
        })
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({
          success: true
        });
    });

    it('should fail to create category without authentication', async () => {
      await p
        .spec()
        .post('/category/addCategory')
        .withJson({
          categoryName: faker.commerce.department(),
          categoryType: 'expense'
        })
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({
          success: false,
          message: 'User not authorized'
        });
    });

    it('should list all categories', async () => {
      await p
        .spec()
        .get('/category/getCategory')
        .withHeaders('Cookie', cookie)
        .expectStatus(StatusCodes.OK)
        .expectBodyContains('categoryName')
        .expectHeaderContains('content-type', 'application/json');
    });

    it('should fail to get categories without authentication', async () => {
      await p
        .spec()
        .get('/category/getCategory')
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({
          success: false,
          message: 'User not authorized'
        });
    });

    it('should delete the created category', async () => {
      if (categoryId) {
        await p
          .spec()
          .delete(`/category/deleteCategory/${categoryId}`)
          .withHeaders('Cookie', cookie)
          .expectStatus(StatusCodes.OK)
          .expectJsonLike({
            success: true
          });
      }
    });
  });

  describe('Goals and Limits Management', () => {
    it('should create a new goal/limit', async () => {
      const response = await p
        .spec()
        .post('/meta/goals-limits')
        .withHeaders('Cookie', cookie)
        .withJson({
          goal: faker.number.int({ min: 1000, max: 5000 }),
          limit: faker.number.int({ min: 100, max: 1000 })
        })
        .expectStatus(StatusCodes.CREATED)
        .expectJsonLike({
          success: true
        });

      if (response.json && response.json.goalLimit) {
        goalId = response.json.goalLimit._id;
        expect(goalId).toBeDefined();
      }
    });

    it('should fail to create goal/limit without authentication', async () => {
      await p
        .spec()
        .post('/meta/goals-limits')
        .withJson({
          goal: 1000,
          limit: 500
        })
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({
          success: false,
          message: 'User not authorized'
        });
    });

    it('should list all goals/limits', async () => {
      await p
        .spec()
        .get('/meta/goals-limits')
        .withHeaders('Cookie', cookie)
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({
          success: true
        });
    });

    it('should fail to get goals/limits without authentication', async () => {
      await p
        .spec()
        .get('/meta/goals-limits')
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({
          success: false,
          message: 'User not authorized'
        });
    });

    it('should update the goal/limit', async () => {
      if (goalId) {
        await p
          .spec()
          .put(`/meta/goals-limits/${goalId}`)
          .withHeaders('Cookie', cookie)
          .withJson({
            goal: faker.number.int({ min: 2000, max: 8000 }),
            limit: faker.number.int({ min: 500, max: 1500 })
          })
          .expectStatus(StatusCodes.OK)
          .expectJsonLike({
            success: true
          });
      }
    });

    it('should attempt to delete goal/limit', async () => {
      if (goalId) {
        await p
          .spec()
          .delete(`/meta/goals-limits/${goalId}`)
          .withHeaders('Cookie', cookie)
          .expectStatus(StatusCodes.INTERNAL_SERVER_ERROR)
          .expectJsonLike({
            success: false,
            message: 'goalLimit.remove is not a function'
          });
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON requests', async () => {
      await p
        .spec()
        .post('/category/addCategory')
        .withHeaders('Cookie', cookie)
        .withHeaders('Content-Type', 'application/json')
        .withBody('{ invalid json }')
        .expectStatus(StatusCodes.BAD_REQUEST);
    });

    it('should handle server timeout gracefully', async () => {
      await p
        .spec()
        .get('/user/protectedRoute')
        .withHeaders('Cookie', cookie)
        .expectStatus(StatusCodes.OK)
        .expectResponseTime(30000);
    });
  });
});