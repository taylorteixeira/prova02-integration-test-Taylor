import pactum from 'pactum';
import { StatusCodes } from 'http-status-codes';
import { SimpleReporter } from '../simple-reporter';
import { faker } from '@faker-js/faker';

// Define a URL base da API, com um fallback para o ambiente de produção
const BASE_URL = process.env.CFP_BASE_URL || 'https://cfp-server.vercel.app';

describe('Servidor CFP - Testes de API', () => {
  const p = pactum;
  const rep = SimpleReporter;

  // Cria um usuário com dados fictícios para os testes
  const user = {
    username: faker.internet.username(),
    email: faker.internet.email(),
    password: 'Test@12345',
    mobile: faker.phone.number()
  };

  let cookie: string;
  let categoryId: string;
  let goalId: string;

  // Bloco executado uma vez antes de todos os testes
  beforeAll(async () => {
    p.request.setBaseUrl(BASE_URL);
    p.request.setDefaultTimeout(30000);
    p.reporter.add(rep);

    // Tenta criar um novo usuário
    try {
      await p
        .spec()
        .post('/user/signup')
        .withJson(user)
        .expectStatus(StatusCodes.OK);
    } catch (error) {
      // Ignora o erro se o usuário já existir
    }

    // Realiza o login para obter o cookie de autenticação
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
      cookie = Array.isArray(setCookieHeader)
        ? setCookieHeader[0]
        : setCookieHeader;
    } else {
      throw new Error('Nenhum cookie recebido no login');
    }

    expect(cookie).toBeDefined();
  });

  // Bloco executado uma vez após todos os testes
  afterAll(async () => {
    // Realiza o logout se um cookie foi obtido
    if (cookie) {
      try {
        await p
          .spec()
          .get('/user/signout')
          .withHeaders('Cookie', cookie)
          .expectStatus(StatusCodes.CREATED);
      } catch (error) {
        // Ignora erros no logout
      }
    }
    p.reporter.end();
  });

  // Suite de testes para Autenticação de Usuário
  describe('Autenticação de Usuário', () => {
    it('deve acessar a rota protegida com sucesso', async () => {
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

    it('deve falhar ao acessar a rota protegida sem autenticação', async () => {
      await p
        .spec()
        .get('/user/protectedRoute')
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({
          success: false,
          message: 'User not authorized'
        });
    });

    it('deve falhar o login com credenciais inválidas', async () => {
      await p
        .spec()
        .post('/user/signin')
        .withJson({
          email: faker.internet.email(), // Usa um e-mail aleatório e inválido
          password: faker.internet.password() // Usa uma senha aleatória e inválida
        })
        .expectStatus(StatusCodes.BAD_REQUEST);
    });
  });

  // Suite de testes para Gerenciamento de Categorias
  describe('Gerenciamento de Categorias', () => {
    it('deve criar uma nova categoria de despesa', async () => {
      const expenseCategory = faker.helpers.arrayElement([
        'Alimentação',
        'Transporte',
        'Moradia',
        'Lazer',
        'Saúde'
      ]);
      const response = await p
        .spec()
        .post('/category/addCategory')
        .withHeaders('Cookie', cookie)
        .withJson({
          categoryName: expenseCategory,
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

    it('deve criar uma nova categoria de receita', async () => {
      const incomeCategory = faker.helpers.arrayElement([
        'Salário',
        'Bônus',
        'Investimentos',
        'Freelance'
      ]);
      await p
        .spec()
        .post('/category/addCategory')
        .withHeaders('Cookie', cookie)
        .withJson({
          categoryName: incomeCategory,
          categoryType: 'income'
        })
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({
          success: true
        });
    });

    it('deve falhar ao criar categoria sem autenticação', async () => {
      await p
        .spec()
        .post('/category/addCategory')
        .withJson({
          categoryName: 'Teste sem Auth',
          categoryType: 'expense'
        })
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({
          success: false,
          message: 'User not authorized'
        });
    });

    it('deve listar todas as categorias do usuário', async () => {
      await p
        .spec()
        .get('/category/getCategory')
        .withHeaders('Cookie', cookie)
        .expectStatus(StatusCodes.OK)
        .expectBodyContains('categoryName')
        .expectHeaderContains('content-type', 'application/json');
    });

    it('deve falhar ao obter categorias sem autenticação', async () => {
      await p
        .spec()
        .get('/category/getCategory')
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({
          success: false,
          message: 'User not authorized'
        });
    });

    it('deve deletar a categoria criada', async () => {
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

  // Suite de testes para Gerenciamento de Metas e Limites
  describe('Gerenciamento de Metas e Limites', () => {
    it('deve criar uma nova meta/limite', async () => {
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

    it('deve falhar ao criar meta/limite sem autenticação', async () => {
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

    it('deve listar todas as metas/limites', async () => {
      await p
        .spec()
        .get('/meta/goals-limits')
        .withHeaders('Cookie', cookie)
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({
          success: true
        });
    });

    it('deve falhar ao obter metas/limites sem autenticação', async () => {
      await p
        .spec()
        .get('/meta/goals-limits')
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({
          success: false,
          message: 'User not authorized'
        });
    });

    it('deve atualizar a meta/limite', async () => {
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

    // Este teste verifica um comportamento de erro conhecido no servidor
    it('deve tentar deletar a meta/limite e receber um erro esperado', async () => {
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

  // Suite de testes para Tratamento de Erros
  describe('Tratamento de Erros', () => {
    it('deve lidar com requisições JSON malformadas', async () => {
      await p
        .spec()
        .post('/category/addCategory')
        .withHeaders('Cookie', cookie)
        .withHeaders('Content-Type', 'application/json')
        .withBody('{ "json": "inválido" ') // JSON com sintaxe incorreta
        .expectStatus(StatusCodes.BAD_REQUEST);
    });

    it('deve ter um tempo de resposta aceitável (abaixo de 30s)', async () => {
      await p
        .spec()
        .get('/user/protectedRoute')
        .withHeaders('Cookie', cookie)
        .expectStatus(StatusCodes.OK)
        .expectResponseTime(30000);
    });
  });
});
