// const bcrypt = require("bcryptjs");
// const fs = require("fs");
// const path = require("path");

// const productsOld = require("../utils/products-old");
// const products = require("../utils/products");

// const handleUpdateMultipleProducts = () => {
//   const updatedProducts = productsOld.map((oldProduct, index) => {
//     const newProduct = products.find((p) => p.slug === oldProduct.slug); // Match by ID

//     if (newProduct) {
//       // console.log(
//       //   "this product updated",
//       //   newProduct?.slug,
//       //   "number",
//       //   index + 1
//       // );
//       return {
//         ...oldProduct,
//         title: newProduct.title,
//         description: newProduct.description,
//         image: newProduct.image,
//       };
//     }
//     console.log(
//       "this product not updated",
//       oldProduct?.slug,
//       "number",
//       index + 1
//     );

//     return oldProduct; // Keep unchanged if no match is found
//   });

//   // Define the path where the updated data should be saved
//   const filePath = path.join(__dirname, "../updated-products.json");

//   // Write the updated products to a JSON file
//   fs.writeFileSync(filePath, JSON.stringify(updatedProducts, null, 2), "utf-8");

//   console.log("Updated products saved to", filePath);
//   process.exit();
// };

// handleUpdateMultipleProducts();

// const generatePassword = () => {
//   const password = "12345678";
//   const hashPassword = bcrypt.hashSync(password);

//   const isPasswordCorrect = bcrypt.compareSync(password, hashPassword);
//   console.log(
//     "hashPassword",
//     hashPassword,
//     "isPasswordCorrect",
//     isPasswordCorrect
//   );

//   process.exit();
// };

// generatePassword();
