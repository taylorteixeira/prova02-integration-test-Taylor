const pactum = require('pactum');

describe('Fluxo Completo de Cadastro e Transações', function () {
  let token = '';
  let categoryId = '';

  it('Deve cadastrar um novo usuário', async () => {
    const response = await pactum
      .spec()
      .post('https://cfp-server.vercel.app/user/signup')
      .withJson({
        name: 'Teste',
        email: 'teste@example.com',
        password: '123456'
      })
      .expectStatus(201);

    // Verificar se o usuário foi criado com sucesso
    response.expectJsonLike({
      success: true,
      message: 'User created successfully'
    });
  });

  it('Deve realizar login e obter o token', async () => {
    const response = await pactum
      .spec()
      .post('https://cfp-server.vercel.app/user/signin')
      .withJson({
        email: 'teste@example.com',
        password: '123456'
      })
      .expectStatus(200);

    // Armazenar o token para uso posterior
    token = response.body.token;
    response.expectJsonLike({
      success: true,
      message: 'User signed in successfully'
    });
  });

  it('Deve criar uma nova categoria', async () => {
    const response = await pactum
      .spec()
      .post('https://cfp-server.vercel.app/category/addCategory')
      .withHeaders('Authorization', `Bearer ${token}`)
      .withJson({
        categoryName: 'Alimentação',
        categoryType: 'expense'
      })
      .expectStatus(200);

    // Armazenar o ID da categoria criada
    categoryId = response.body.categoryId;
    response.expectJsonLike({
      success: true,
      message: 'Category added successfully'
    });
  });

  it('Deve criar uma nova transação', async () => {
    await pactum
      .spec()
      .post('https://cfp-server.vercel.app/transaction/addTransaction')
      .withHeaders('Authorization', `Bearer ${token}`)
      .withJson({
        categoryId: categoryId,
        amount: 50,
        description: 'Almoço'
      })
      .expectStatus(200);
  });
});
