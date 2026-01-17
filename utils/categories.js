const categories = [
  {
    "_id": "62c827b5a427b63741da9175",
    "status": "show",
    "name": {
      "en": "Home",
      "es": "Inicio"
    },
    "id": "Root",
    "parentName": "Home",
    "description": {
      "en": "This is Home Category",
      "es": "Esta es la categoría de Home"
    }
  },
  {
    "_id": "62cc0791d511b304aecdfbf2",
    "status": "show",
    "name": {
      "en": "Baby Food",
      "de": "Babynahrung",
      "es": "Comida para bebé"
    },
    "parentId": "62cc0637d511b304aecdfba8",
    "parentName": "Baby Care",
    "description": {
      "en": "This is baby food category",
      "es": "Esta es la categoría de Baby Food"
    },
    "icon": ""
  },
  {
    "_id": "62cc07b8d511b304aecdfbfa",
    "status": "show",
    "name": {
      "en": "Baby Accessories",
      "de": "Baby Accessoires",
      "es": "Accesorios para bebé"
    },
    "parentId": "62cc0637d511b304aecdfba8",
    "parentName": "Baby Care",
    "description": {
      "en": "This is baby accessories",
      "es": "This is baby accessories"
    },
    "icon": ""
  },
  {
    "_id": "62cfab28484d89068aa7a7f5",
    "status": "show",
    "name": {
      "en": "Chocolate",
      "es": "Chocolate"
    },
    "parentId": "62cfab19484d89068aa7a7ef",
    "parentName": "Snacks & Instant",
    "description": {
      "en": "This is Chocolate category",
      "es": "Esta es la categoría de Chocolate"
    },
    "icon": ""
  },
  {
    "_id": "62cfab39484d89068aa7a7fb",
    "status": "show",
    "name": {
      "en": "Chips & Nuts",
      "es": "Snacks y Frutos secos"
    },
    "parentId": "62cfab19484d89068aa7a7ef",
    "parentName": "Snacks & Instant",
    "description": {
      "en": "This is Chips & Nuts category",
      "es": "Esta es la categoría de Chips & Nuts"
    },
    "icon": ""
  },
  {
    "_id": "62cfab4b484d89068aa7a7ff",
    "status": "show",
    "name": {
      "en": "Canned Food",
      "es": "Alimentos enlatados"
    },
    "parentId": "62cfab19484d89068aa7a7ef",
    "parentName": "Snacks & Instant",
    "description": {
      "en": "This is Canned Food category",
      "es": "Esta es la categoría de Canned Food"
    },
    "icon": ""
  },
  {
    "_id": "62cfad3d484d89068aa7a819",
    "status": "show",
    "name": {
      "en": "Sauces",
      "es": "Salsas"
    },
    "parentId": "62cfad20484d89068aa7a812",
    "parentName": "Sauces & Pickles",
    "description": {
      "en": "This is Sauces category",
      "es": "Esta es la categoría de Sauces"
    },
    "icon": ""
  },
  {
    "_id": "62cfad52484d89068aa7a81f",
    "status": "show",
    "name": {
      "en": "Pickles & Condiments",
      "es": "Conservas y condimentos"
    },
    "parentId": "62cfad20484d89068aa7a812",
    "parentName": "Sauces & Pickles",
    "description": {
      "en": "This is Pickles & Condiments category",
      "es": "Esta es la categoría de Pickles & Condiments"
    },
    "icon": ""
  },
  {
    "_id": "62d02efd2d28e904b20e22bf",
    "status": "show",
    "name": {
      "en": "Tuna",
      "es": "Atún"
    },
    "description": {
      "en": "This is tuna fish category",
      "es": "Esta es la categoría de Tuna"
    },
    "parentId": "62c851ae00bc1e3f08bb8191",
    "parentName": "Fish",
    "icon": ""
  },
  {
    "_id": "62d03a312d28e904b20e233c",
    "status": "show",
    "name": {
      "en": "Tuna",
      "de": "Thunfisch",
      "es": "Atún"
    },
    "description": {
      "en": "This is tuna category",
      "de": "Dies ist die Thunfisch-Kategorie",
      "es": "Esta es la categoría de Tuna"
    },
    "parentId": "62d03a112d28e904b20e2336",
    "parentName": "Fish",
    "icon": ""
  },
  {
    "_id": "62d03a542d28e904b20e2342",
    "status": "show",
    "name": {
      "en": "Rui",
      "de": "Rui",
      "es": "Rui"
    },
    "description": {
      "en": "This is Rui category",
      "de": "Dies ist die Rui-Kategorie",
      "es": "Esta es la categoría de Rui"
    },
    "parentId": "62d03a112d28e904b20e2336",
    "parentName": "Fish",
    "icon": ""
  },
  {
    "_id": "62d2bbd22e63b40520194f1b",
    "status": "show",
    "name": {
      "en": "Apple",
      "es": "Manzana"
    },
    "parentId": "62cf9f32484d89068aa7a75f",
    "parentName": "Fresh Fruits",
    "description": {
      "en": "This is the apple category",
      "es": "Esta es la categoría de Apple"
    },
    "icon": ""
  },
  {
    "_id": "62d2bbe62e63b40520194f21",
    "status": "show",
    "name": {
      "en": "Orange",
      "es": "Naranja"
    },
    "description": {
      "en": "This is orange category",
      "es": "Esta es la categoría de Orange"
    },
    "parentId": "62cf9f32484d89068aa7a75f",
    "parentName": "Fresh Fruits",
    "icon": ""
  },
  {
    "_id": "62e4ebb90ea79023fc11d847",
    "status": "show",
    "name": {
      "en": "Beef",
      "de": "Rindfleisch",
      "es": "Carne de res"
    },
    "description": {
      "en": "This is Beef Category",
      "de": "Dies ist die Kategorie Rindfleisch",
      "es": "Esta es la categoría de Beef"
    },
    "parentId": "62c851be00bc1e3f08bb8197",
    "parentName": "Meat",
    "icon": ""
  },
  {
    "_id": "632aae414d87ff2494210945",
    "status": "show",
    "name": {
      "en": "Breakfast",
      "es": "Desayuno"
    },
    "description": {
      "en": "Breakfast",
      "es": "Desayuno"
    },
    "parentId": "62c827b5a427b63741da9175",
    "parentName": "Home",
    "icon": "https://res.cloudinary.com/ahossain/image/upload/v1658340705/category%20icon/bagel_mt3fod.png"
  },
  {
    "_id": "632aae624d87ff2494210951",
    "status": "show",
    "name": {
      "en": "Cereal",
      "es": "Cereales"
    },
    "description": {
      "en": "Cereal",
      "es": "Cereales"
    },
    "parentId": "632aae414d87ff2494210945",
    "parentName": "Breakfasts",
    "icon": ""
  },
  {
    "_id": "632aae7b4d87ff2494210967",
    "status": "show",
    "name": {
      "en": "Bread",
      "es": "Pan"
    },
    "description": {
      "en": "Bread",
      "es": "Pan"
    },
    "parentId": "632aae414d87ff2494210945",
    "parentName": "Breakfasts",
    "icon": ""
  },
  {
    "_id": "632ab0334d87ff24942109c1",
    "status": "show",
    "name": {
      "en": "Drinks",
      "es": "Bebidas"
    },
    "description": {
      "en": "Drinks",
      "es": "Bebidas"
    },
    "parentId": "62c827b5a427b63741da9175",
    "parentName": "Home",
    "icon": "https://res.cloudinary.com/ahossain/image/upload/v1658340705/category%20icon/juice_p5gv5k.png"
  },
  {
    "_id": "632ab0454d87ff24942109cc",
    "status": "show",
    "name": {
      "en": "Energy Drinks",
      "es": "Bebidas energéticas"
    },
    "description": {
      "en": "Energy Drinks",
      "es": "Bebidas energéticas"
    },
    "parentId": "632ab0334d87ff24942109c1",
    "parentName": "Drink",
    "icon": ""
  },
  {
    "_id": "632ab0504d87ff24942109d7",
    "status": "show",
    "name": {
      "en": "Coffee",
      "es": "Café"
    },
    "description": {
      "en": "Coffee",
      "es": "Café"
    },
    "parentId": "632ab0334d87ff24942109c1",
    "parentName": "Drink",
    "icon": ""
  },
  {
    "_id": "632ab0564d87ff24942109df",
    "status": "show",
    "name": {
      "en": "Juice",
      "es": "Jugo"
    },
    "description": {
      "en": "Juice",
      "es": "Jugo"
    },
    "parentId": "632ab0334d87ff24942109c1",
    "parentName": "Drink",
    "icon": ""
  },
  {
    "_id": "632ab0604d87ff24942109e7",
    "status": "show",
    "name": {
      "en": "Water",
      "es": "Agua"
    },
    "description": {
      "en": "Water",
      "es": "Agua"
    },
    "parentId": "632ab0334d87ff24942109c1",
    "parentName": "Drink",
    "icon": ""
  },
  {
    "_id": "632ab0664d87ff24942109ef",
    "status": "show",
    "name": {
      "en": "Tea",
      "es": "Té"
    },
    "description": {
      "en": "Tea",
      "es": "Té"
    },
    "parentId": "632ab0334d87ff24942109c1",
    "parentName": "Drink",
    "icon": ""
  },
  {
    "_id": "632ab14a4d87ff2494210a29",
    "status": "show",
    "name": {
      "en": "Milk & Dairy",
      "es": "Leche y lácteos"
    },
    "description": {
      "en": "Milk & Dairy",
      "es": "Leche y lácteos"
    },
    "parentId": "62c827b5a427b63741da9175",
    "parentName": "Home",
    "icon": "https://res.cloudinary.com/ahossain/image/upload/v1658340706/category%20icon/milk_dcl0dr.png"
  },
  {
    "_id": "632ab1584d87ff2494210a31",
    "status": "show",
    "name": {
      "en": "Dairy",
      "es": "Lácteos"
    },
    "description": {
      "en": "Dairy",
      "es": "Lácteos"
    },
    "parentId": "632ab14a4d87ff2494210a29",
    "parentName": "Milk & Dairys",
    "icon": ""
  },
  {
    "_id": "632ab1644d87ff2494210a3c",
    "status": "show",
    "name": {
      "en": "Ice Cream",
      "es": "Helado"
    },
    "description": {
      "en": "Ice Cream",
      "es": "Helado"
    },
    "parentId": "632ab14a4d87ff2494210a29",
    "parentName": "Milk & Dairys",
    "icon": ""
  },
  {
    "_id": "632ab16c4d87ff2494210a44",
    "status": "show",
    "name": {
      "en": "Butter & Ghee",
      "es": "Mantequilla y ghee"
    },
    "description": {
      "en": "Butter & Ghee",
      "es": "Mantequilla y ghee"
    },
    "parentId": "632ab14a4d87ff2494210a29",
    "parentName": "Milk & Dairys",
    "icon": ""
  },
  {
    "_id": "632ab1e04d87ff2494210a6a",
    "status": "show",
    "name": {
      "en": "Jam & Jelly",
      "es": "Mermeladas y jaleas"
    },
    "description": {
      "en": "Jam & Jelly",
      "es": "Mermeladas y jaleas"
    },
    "parentId": "62c827b5a427b63741da9175",
    "parentName": "Home",
    "icon": "https://i.postimg.cc/rmLvfsMC/strawberry-jam-1.png"
  },
  {
    "_id": "632ab2864d87ff2494210a8a",
    "status": "show",
    "name": {
      "en": "Beauty & Healths",
      "es": "Belleza y salud"
    },
    "description": {
      "en": "Beauty & Healths",
      "es": "Belleza y salud"
    },
    "parentId": "62c827b5a427b63741da9175",
    "parentName": "Home",
    "icon": "https://res.cloudinary.com/ahossain/image/upload/v1658340706/category%20icon/beauty_vfbmzc.png"
  },
  {
    "_id": "632ab2b64d87ff2494210aa7",
    "status": "show",
    "name": {
      "en": "Men",
      "es": "Hombres"
    },
    "description": {
      "en": "Men",
      "es": "Hombres"
    },
    "parentId": "632ab2864d87ff2494210a8a",
    "parentName": "Beauty & Healths",
    "icon": ""
  },
  {
    "_id": "632ab2c34d87ff2494210ab2",
    "status": "show",
    "name": {
      "en": "Women",
      "es": "Mujeres"
    },
    "description": {
      "en": "Women",
      "es": "Mujeres"
    },
    "parentId": "632ab2864d87ff2494210a8a",
    "parentName": "Beauty & Healths",
    "icon": ""
  },
  {
    "_id": "632ab2d54d87ff2494210ac0",
    "status": "show",
    "name": {
      "en": "Shaving Needs",
      "es": "Artículos de afeitado"
    },
    "description": {
      "en": "Shaving Needs",
      "es": "Artículos de afeitado"
    },
    "parentId": "632ab2b64d87ff2494210aa7",
    "parentName": "Men",
    "icon": ""
  },
  {
    "_id": "632ab2df4d87ff2494210ac8",
    "status": "show",
    "name": {
      "en": "Body Care",
      "es": "Cuidado corporal"
    },
    "description": {
      "en": "Body Care",
      "es": "Cuidado corporal"
    },
    "parentId": "632ab2b64d87ff2494210aa7",
    "parentName": "Men",
    "icon": ""
  },
  {
    "_id": "632ab2f04d87ff2494210ad0",
    "status": "show",
    "name": {
      "en": "Skin Care",
      "es": "Cuidado de la piel"
    },
    "description": {
      "en": "Skin Care",
      "es": "Cuidado de la piel"
    },
    "parentId": "632ab2c34d87ff2494210ab2",
    "parentName": "Women",
    "icon": ""
  },
  {
    "_id": "632ab2f84d87ff2494210ad8",
    "status": "show",
    "name": {
      "en": "Oral Care",
      "es": "Cuidado oral"
    },
    "description": {
      "en": "Oral Care",
      "es": "Cuidado oral"
    },
    "parentId": "632ab2c34d87ff2494210ab2",
    "parentName": "Women",
    "icon": ""
  },
  {
    "_id": "632ab2fd4d87ff2494210ae0",
    "status": "show",
    "name": {
      "en": "Cosmetics",
      "es": "Cosméticos"
    },
    "description": {
      "en": "Cosmetics",
      "es": "Cosméticos"
    },
    "parentId": "632ab2c34d87ff2494210ab2",
    "parentName": "Women",
    "icon": ""
  },
  {
    "_id": "632ab3044d87ff2494210ae8",
    "status": "show",
    "name": {
      "en": "Bath",
      "es": "Baño"
    },
    "description": {
      "en": "Bath",
      "es": "Baño"
    },
    "parentId": "632ab2c34d87ff2494210ab2",
    "parentName": "Women",
    "icon": ""
  },
  {
    "_id": "632ab4434d87ff2494210b0e",
    "status": "show",
    "name": {
      "en": "Pet Care",
      "es": "Cuidado de mascotas"
    },
    "description": {
      "en": "Pet Care",
      "es": "Cuidado de mascotas"
    },
    "parentId": "62c827b5a427b63741da9175",
    "parentName": "Home",
    "icon": "https://res.cloudinary.com/ahossain/image/upload/v1658340707/category%20icon/cat_tznwmq.png"
  },
  {
    "_id": "632ab4524d87ff2494210b19",
    "status": "show",
    "name": {
      "en": "Cat Care",
      "es": "Cuidado de gatos"
    },
    "description": {
      "en": "Cat Care",
      "es": "Cuidado de gatos"
    },
    "parentId": "632ab4434d87ff2494210b0e",
    "parentName": "Pet Cares",
    "icon": ""
  },
  {
    "_id": "632ab45b4d87ff2494210b21",
    "status": "show",
    "name": {
      "en": "Dog Care",
      "es": "Cuidado de perros"
    },
    "description": {
      "en": "Dog Care",
      "es": "Cuidado de perros"
    },
    "parentId": "632ab4434d87ff2494210b0e",
    "parentName": "Pet Cares",
    "icon": ""
  },
  {
    "_id": "632ac9864d87ff2494210b49",
    "status": "show",
    "name": {
      "en": "Household Tools",
      "es": "Herramientas del hogar"
    },
    "description": {
      "en": "Household Tools",
      "es": "Herramientas del hogar"
    },
    "parentId": "62c827b5a427b63741da9175",
    "parentName": "Home",
    "icon": "https://res.cloudinary.com/ahossain/image/upload/v1658340706/category%20icon/spray_pebsjt.png"
  },
  {
    "_id": "632ac9934d87ff2494210b54",
    "status": "show",
    "name": {
      "en": "Cleaner",
      "es": "Limpiador"
    },
    "description": {
      "en": "Cleaner",
      "es": "Limpiador"
    },
    "parentId": "632ac9864d87ff2494210b49",
    "parentName": "Household Tool",
    "icon": ""
  },
  {
    "_id": "632ac9984d87ff2494210b5c",
    "status": "show",
    "name": {
      "en": "Luandry",
      "es": "Lavandería"
    },
    "description": {
      "en": "Luandry",
      "es": "Lavandería"
    },
    "parentId": "632ac9864d87ff2494210b49",
    "parentName": "Household Tool",
    "icon": ""
  },
  {
    "_id": "632ac99d4d87ff2494210b64",
    "status": "show",
    "name": {
      "en": "Air Freshener",
      "es": "Ambientador"
    },
    "description": {
      "en": "Air Freshener",
      "es": "Ambientador"
    },
    "parentId": "632ac9864d87ff2494210b49",
    "parentName": "Household Tool",
    "icon": ""
  },
  {
    "_id": "632ac9b24d87ff2494210b74",
    "status": "show",
    "name": {
      "en": "Pest Control",
      "es": "Control de plagas"
    },
    "description": {
      "en": "Pest Control",
      "es": "Control de plagas"
    },
    "parentId": "632ac9864d87ff2494210b49",
    "parentName": "Household Tool",
    "icon": ""
  },
  {
    "_id": "632ac9ba4d87ff2494210b7c",
    "status": "show",
    "name": {
      "en": "Cleaning Tools",
      "es": "Herramientas de limpieza"
    },
    "description": {
      "en": "Cleaning Tools",
      "es": "Herramientas de limpieza"
    },
    "parentId": "632ac9864d87ff2494210b49",
    "parentName": "Household Tool",
    "icon": ""
  },
  {
    "_id": "632ac9c24d87ff2494210b84",
    "status": "show",
    "name": {
      "en": "Water Filter",
      "es": "Filtro de agua"
    },
    "description": {
      "en": "Water Filter",
      "es": "Filtro de agua"
    },
    "parentId": "632ac9864d87ff2494210b49",
    "parentName": "Household Tool",
    "icon": ""
  },
  {
    "_id": "632ac9e94d87ff2494210ba0",
    "status": "show",
    "name": {
      "en": "Biscuits & Cakes",
      "es": "Galletas y pasteles"
    },
    "description": {
      "en": "Biscuits & Cakes",
      "es": "Galletas y pasteles"
    },
    "parentId": "62c827b5a427b63741da9175",
    "parentName": "Home",
    "icon": "https://res.cloudinary.com/ahossain/image/upload/v1658340705/category%20icon/cookie_1_ugipqa.png"
  },
  {
    "_id": "632ac9ef4d87ff2494210ba8",
    "status": "show",
    "name": {
      "en": "Cakes",
      "es": "Pasteles"
    },
    "description": {
      "en": "Cakes",
      "es": "Pasteles"
    },
    "parentId": "632ac9e94d87ff2494210ba0",
    "parentName": "Biscuits & Cake",
    "icon": ""
  },
  {
    "_id": "632ac9f64d87ff2494210bb0",
    "status": "show",
    "name": {
      "en": "Biscuits",
      "es": "Galletas"
    },
    "description": {
      "en": "Biscuits",
      "es": "Galletas"
    },
    "parentId": "632ac9e94d87ff2494210ba0",
    "parentName": "Biscuits & Cake",
    "icon": ""
  },
  {
    "_id": "632aca0b4d87ff2494210bc4",
    "status": "show",
    "name": {
      "en": "Cooking Essentials",
      "es": "Esenciales de cocina"
    },
    "description": {
      "en": "Cooking Essentials",
      "es": "Esenciales de cocina"
    },
    "parentId": "62c827b5a427b63741da9175",
    "parentName": "Home",
    "icon": "https://res.cloudinary.com/ahossain/image/upload/v1658340704/category%20icon/frying-pan_vglm5c.png"
  },
  {
    "_id": "632aca144d87ff2494210bcc",
    "status": "show",
    "name": {
      "en": "Oil",
      "es": "Aceite"
    },
    "description": {
      "en": "Oil",
      "es": "Aceite"
    },
    "parentId": "632aca0b4d87ff2494210bc4",
    "parentName": "Cooking Essential",
    "icon": ""
  },
  {
    "_id": "632aca184d87ff2494210bd4",
    "status": "show",
    "name": {
      "en": "Flour",
      "es": "Harina"
    },
    "description": {
      "en": "Flour",
      "es": "Harina"
    },
    "parentId": "632aca0b4d87ff2494210bc4",
    "parentName": "Cooking Essential",
    "icon": ""
  },
  {
    "_id": "632aca2b4d87ff2494210be8",
    "status": "show",
    "name": {
      "en": "Fruits & Vegetable",
      "es": "Frutas y verduras"
    },
    "description": {
      "en": "Fruits & Vegetable",
      "es": "Frutas y verduras"
    },
    "parentId": "62c827b5a427b63741da9175",
    "parentName": "Home",
    "icon": "https://res.cloudinary.com/ahossain/image/upload/v1658340704/category%20icon/cabbage_n59uv3.png"
  },
  {
    "_id": "632aca374d87ff2494210bf0",
    "status": "show",
    "name": {
      "en": "Fresh Vegetable",
      "es": "Verduras frescas"
    },
    "description": {
      "en": "Fresh Vegetable",
      "es": "Verduras frescas"
    },
    "parentId": "632aca2b4d87ff2494210be8",
    "parentName": "Fruits & Vegetables",
    "icon": ""
  },
  {
    "_id": "632aca3d4d87ff2494210bf8",
    "status": "show",
    "name": {
      "en": "Dry Fruits",
      "es": "Frutos secos"
    },
    "description": {
      "en": "Dry Fruits",
      "es": "Frutos secos"
    },
    "parentId": "632aca2b4d87ff2494210be8",
    "parentName": "Fruits & Vegetables",
    "icon": ""
  },
  {
    "_id": "632aca454d87ff2494210c00",
    "status": "show",
    "name": {
      "en": "Fresh Fruits",
      "es": "Frutas frescas"
    },
    "description": {
      "en": "Fresh Fruits",
      "es": "Frutas frescas"
    },
    "parentId": "632aca2b4d87ff2494210be8",
    "parentName": "Fruits & Vegetables",
    "icon": ""
  },
  {
    "_id": "632aca524d87ff2494210c08",
    "status": "show",
    "name": {
      "en": "Apple",
      "es": "Manzana"
    },
    "description": {
      "en": "Apple",
      "es": "Manzana"
    },
    "parentId": "632aca454d87ff2494210c00",
    "parentName": "Fresh Fruits",
    "icon": ""
  },
  {
    "_id": "632aca594d87ff2494210c10",
    "status": "show",
    "name": {
      "en": "Orange",
      "es": "Naranja"
    },
    "description": {
      "en": "Orange",
      "es": "Naranja"
    },
    "parentId": "632aca454d87ff2494210c00",
    "parentName": "Fresh Fruits",
    "icon": ""
  },
  {
    "_id": "632aca6d4d87ff2494210c24",
    "status": "show",
    "name": {
      "en": "Fish & Meat",
      "es": "Pescados y carnes"
    },
    "description": {
      "en": "Fish & Meat",
      "es": "Pescados y carnes"
    },
    "parentId": "62c827b5a427b63741da9175",
    "parentName": "Home",
    "icon": "https://res.cloudinary.com/ahossain/image/upload/v1658340705/category%20icon/carp-fish_paxzrt.png"
  },
  {
    "_id": "632aca754d87ff2494210c2c",
    "status": "show",
    "name": {
      "en": "Meat",
      "es": "Carne"
    },
    "description": {
      "en": "Meat",
      "es": "Carne"
    },
    "parentId": "632aca6d4d87ff2494210c24",
    "parentName": "Fish & Meats",
    "icon": ""
  },
  {
    "_id": "632aca7e4d87ff2494210c34",
    "status": "show",
    "name": {
      "en": "Fish",
      "es": "Pescado"
    },
    "description": {
      "en": "Fish",
      "es": "Pescado"
    },
    "parentId": "632aca6d4d87ff2494210c24",
    "parentName": "Fish & Meats",
    "icon": ""
  },
  {
    "_id": "632aca864d87ff2494210c3c",
    "status": "show",
    "name": {
      "en": "Beef",
      "es": "Carne de res"
    },
    "description": {
      "en": "Beef",
      "es": "Carne de res"
    },
    "parentId": "632aca754d87ff2494210c2c",
    "parentName": "Meat",
    "icon": ""
  },
  {
    "_id": "632aca944d87ff2494210c47",
    "status": "show",
    "name": {
      "en": "Tuna",
      "es": "Atún"
    },
    "description": {
      "en": "Tuna",
      "es": "Atún"
    },
    "parentId": "632aca7e4d87ff2494210c34",
    "parentName": "Fish",
    "icon": ""
  },
  {
    "_id": "632aca9b4d87ff2494210c4f",
    "status": "show",
    "name": {
      "en": "Rui",
      "es": "Rui"
    },
    "description": {
      "en": "Rui",
      "es": "Rui"
    },
    "parentId": "632aca7e4d87ff2494210c34",
    "parentName": "Fish",
    "icon": ""
  },
  {
    "_id": "63f12afdcc480f0454f475dd",
    "status": "show",
    "name": {
      "en": "Baby Food",
      "es": "Comida para bebé"
    },
    "description": {
      "en": "Baby Food",
      "es": "Comida para bebé"
    },
    "parentId": "632aca2b4d87ff2494210be8",
    "parentName": "Fruits & Vegetable",
    "icon": ""
  }
]

module.exports = categories;
