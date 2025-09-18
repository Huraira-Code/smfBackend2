const OpenAI = require("openai");
const User = require("../models/user_model");
const uploadOnCloudinary = require("../utils/cloudinary.js");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const sendMail = require("../utils/nodemailer.js");
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const VerificationToken = require("../models/verificationToken_model.js");
const { ImageAnnotatorClient } = require("@google-cloud/vision"); // For Google Cloud Vision OCR
const multer = require("multer"); // For handling file uploads
const upload = multer({ storage: multer.memoryStorage() }); // Store files in memory
const fs = require("fs"); // <--- Import Node.js File System module
const path = require("path"); // <--- Import Node.js Path module

const openai = new OpenAI({
  apiKey: "sk-4ea30ebddbc241a7a497fb93520f37d5", // set in .env
  baseURL: "https://api.deepseek.com",
});
process.env.GOOGLE_APPLICATION_CREDENTIALS =
  "./chemicalfinder-3872dc255a78.json";

const sendTokenMail = require("../utils/nodemailer.js");

const createAndSendToken = async (userId, reciever) => {
  const randomToken = Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000;
  const randomTokenString = String(randomToken); // Converts the number to a string

  try {
    // Check if userId already exists in the VerificationToken table
    let existingToken = await VerificationToken.findOne({ owner: userId });
    console.log(existingToken);
    if (existingToken) {
      // Update the existing token
      try {
        // Update the token value and save it to the database
        existingToken.token = randomTokenString;
        await existingToken.save(); // Save changes

        // If saving is successful, proceed to send the email
        await sendTokenMail(
          "Reminder Application Token Provider",
          randomTokenString,
          reciever
        );

        return { status: "success" }; // Both operations succeeded
      } catch (error) {
        // Catch any errors during saving or email sending
        return { status: "failed", msg: error.message };
      }
    } else {
      try {
        // Create a new verification token entry
        const newToken = await VerificationToken.create({
          owner: userId,
          token: randomTokenString,
        });

        // If the token creation succeeds, proceed to send the email
        await sendTokenMail(
          "Reminder Application Token Provider",
          randomTokenString,
          reciever
        );

        return { status: "success" }; // Both operations succeeded
      } catch (error) {
        // Catch any errors during token creation or email sending
        return { status: "failed", msg: error.message };
      }
    }
  } catch (error) {
    console.error("Error handling verification token:", error.message);
    throw error; // Throw the error for further handling
  }
};

const handleRepeatTokenSend = async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader.split(" ")[1];
  const verify = jwt.verify(token, process.env.JWT_SECRET);
  console.log(verify);
  try {
    const createTokenResult = await createAndSendToken(
      verify._id,
      verify.email
    );
    res
      .status(200)
      .json({ msg: "Token have been succesfully sended to your email" });
  } catch (error) {
    res.status(404).json({ msg: error });
  }
};

const VerifyToken = async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader.split(" ")[1];
  try {
    const verify = jwt.verify(token, process.env.JWT_SECRET);
    const id = verify._id;

    const tokenEntry = await VerificationToken.findOne({ owner: id });
    if (!tokenEntry) {
      return res
        .status(404)
        .json({ status: "Error", msg: "Token entry not found" });
    }

    const sendedToken = req.body.token;
    const validated = await bcrypt.compare(sendedToken, tokenEntry.token);
    if (validated) {
      // Update the user's verified field to true after successful validation
      const updatedUser = await User.findOneAndUpdate(
        { _id: id }, // Find the user by ID
        { Verified: true }, // Set the verified field to true
        { new: true } // Return the updated document
      );

      if (!updatedUser) {
        return res.status(404).json({ status: "Error", msg: "User not found" });
      }

      return res.status(200).json({
        status: "Matched Successfully",
        msg: "You have entered the right code",
        user: updatedUser,
      });
    } else {
      return res.status(400).json({
        status: "OTP Code Not Matched",
        msg: "You have entered the wrong OTP Code",
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      status: "Error",
      msg: "An internal error occurred",
      error: error.message,
    });
  }
};

const changeForgetPassword = async (req, res) => {
  const password = req.body.password;
  const email = req.body.email;

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update the user's password
    const updatedUser = await User.findOneAndUpdate(
      { email: email }, // Find user by email
      { password: hashedPassword }, // Update the password
      { new: true } // Return the updated document
    );

    if (!updatedUser) {
      return res
        .status(404)
        .json({ status: "Error", msg: "User update failed" });
    }

    res.status(200).json({ msg: "Password have been succesfully changed" });
  } catch (error) {
    console.log(error);
  }
};

const forgetPasswordSend = async (req, res) => {
  console.log("hitting functions");
  try {
    const { email } = req.body; // Extract email from request body

    // Find user by email
    const user = await User.findOne({ email });

    // Check if user exists
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const createTokenResult = await createAndSendToken(user._id, user.email);
    res.status(200).json(createTokenResult);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const forgetPasswordChange = async (req, res) => {
  try {
    // Retrieve user by email (assuming email is provided in the request body)
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).json({ status: "Error", msg: "User not found" });
    }

    // Find the verification token associated with the user
    const tokenEntry = await VerificationToken.findOne({ owner: user._id });
    if (!tokenEntry) {
      return res
        .status(404)
        .json({ status: "Error", msg: "Token entry not found" });
    }

    const sendedToken = req.body.token;
    // Validate the token
    console.log(sendedToken);
    console.log(tokenEntry.token);
    const validated = await bcrypt.compare(sendedToken, tokenEntry.token);
    if (validated) {
      return res.status(200).json({
        status: "OTP MATCHED",
        msg: "OTP Have Successfull mathced",
      });
    } else {
      return res.status(400).json({
        status: "OTP Code Not Matched",
        msg: "You have entered the wrong OTP Code",
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: "Error",
      msg: "An internal error occurred",
      error: error.message,
    });
  }
};

const handleUserSignUp = async (req, res) => {
  console.log(req.body);
  console.log(process.env.JWT_SECRET);
  try {
    const { name, email, password } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    if (!name || !email || !password) {
      return res.status(401).json({ msg: "all fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(409)
        .json({ msg: "Email is already registered. Please Login " }); // 409 Conflict
    }

    const user = await User.create({
      name: name,
      email: email,
      password: hashedPassword,
    });
    if (user) {
      const { _id, name } = user;
      const token = jwt.sign({ _id, name }, process.env.JWT_SECRET, {
        expiresIn: "30d",
      });
      return res.json({ msg: "Succesfully Signed Up", token: token });
      console.log("a");
    }
  } catch (error) {
    console.log(error);
    return res.status(404).json({ msg: error });
  }
};

const addUserHistory = async (req, res) => {
  try {
    // Get the token from header
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ msg: "No token provided" });

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded._id;

    // Extract history fields from body
    const { type, result } = req.body;
    if (!type) {
      return res.status(400).json({ msg: "Type and result are required" });
    }

    // Handle image upload to Cloudinary
    let imgUrl = "";
    if (req.file) {
      const localFilePath = req.file.path;
      console.log(req.file);
      imgUrlUnfinished = await uploadOnCloudinary(localFilePath);
      imgUrl = imgUrlUnfinished.secure_url;
      console.log("edabkjjgha ", imgUrl.url);
      // Delete local temp file
      // fs.unlinkSync(localFilePath);

      if (!imgUrl) {
        return res.status(500).json({ msg: "Image upload failed" });
      }
    } else {
      return res.status(400).json({ msg: "Image file is required" });
    }

    // Create the history object
    const newHistory = {
      type,
      imgUrl,
      result,
      timestamp: new Date(),
    };

    console.log(newHistory);
    // Push to user's history
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $push: { history: newHistory } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ msg: "User not found" });
    }

    return res.status(200).json({ msg: "History added", history: newHistory });
  } catch (error) {
    console.error("Error adding history:", error);
    return res.status(500).json({ msg: "Server error", error });
  }
};

const addProfileImage = async (req, res) => {
  try {
    // Extract and verify token
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ msg: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded._id;

    // Check if file is attached
    if (!req.file) {
      return res.status(400).json({ msg: "Profile image file is required" });
    }

    // Upload image to Cloudinary
    const localFilePath = req.file.path;
    const uploadedImg = await uploadOnCloudinary(localFilePath);
    if (!uploadedImg?.url) {
      return res.status(500).json({ msg: "Image upload failed" });
    }

    // Set profileImage in user document
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profileImage: uploadedImg.secure_url },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ msg: "User not found" });
    }

    return res.status(200).json({
      msg: "Profile image updated",
      profileImage: uploadedImg.url,
    });
  } catch (error) {
    console.error("Error uploading profile image:", error);
    return res.status(500).json({ msg: "Server error", error });
  }
};

const getUserHistory = async (req, res) => {
  try {
    // Get the token from header
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ msg: "No token provided" });

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded._id;

    // Find user and get only history
    const user = await User.findById(userId).select("history");
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    return res.status(200).json({
      msg: "User history fetched",
      history: user.history,
    });
  } catch (error) {
    console.error("Error fetching history:", error);
    return res.status(500).json({ msg: "Server error", error });
  }
};

const handleUserLogin = async (req, res) => {
  console.log("abchd");
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.json({ msg: "all fields are required" });
    }
    const user = await User.findOne({
      email: email,
    });

    if (user) {
      console.log("me3", user);
      const { _id, name } = user;
      console.log("me2", user);
      const validated = await bcrypt.compare(password, user.password);
      if (validated) {
        console.log(process.env.JWT_SECRET);
        const token = jwt.sign({ _id, name }, process.env.JWT_SECRET, {
          expiresIn: "30d",
        });
        return res
          .status(200)
          .json({ msg: "Successfully logged in", token: token });
      } else {
        return res.status(401).json({ msg: "Email or password is incorrect" }); // 401 Unauthorized
      }
    } else {
      return res.status(404).json({ msg: "Email or password is incorrect" }); // 404 Not Found
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ err: error.message }); // 500 Internal Server Error
  }
};

const handleViewProfile = async (req, res) => {
  console.log("hello");
  const authHeader = req.headers.authorization;

  // Validate Authorization Header
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Authorization header missing or malformed" });
  }

  // Extract Token
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Token not provided" });
  }

  // Verify Token
  let verify;
  try {
    verify = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(403).json({ message: "Invalid or expired token", error });
  }

  const { _id } = verify;
  if (!_id) {
    return res.status(400).json({ message: "Invalid token payload" });
  }

  // Find User
  const user = await User.findById(_id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // Return User Data
  return res.status(200).json({ user });
};

const changePassword = async (req, res) => {
  console.log(req.body);
  try {
    // 1. Extract the Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader.split(" ")[1];
    const verify = jwt.verify(token, process.env.JWT_SECRET);
    const { _id } = verify;

    // 4. Extract passwords from request body
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Old password and new password are required" });
    }

    // 5. Fetch the user from the database
    const user = await User.findOne({ _id: _id });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    // 6. Compare the old password with the stored hashed password
    const isMatch = await bcrypt.compare(oldPassword, user.password); // Adjust the field name as needed

    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect current password" });
    }

    // 7. Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 8. Update the user's password in the database
    user.password = hashedPassword; // Adjust the field name as needed
    await user.save();

    // 9. Respond with success message
    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const sendSupportEmail = async (req, res) => {
  try {
    const message = req.body;
    sendMail("Reminder App Support Mail", message.message);
    res.json({ status: "success" });
  } catch (error) {
    res.json({ status: "failed", msg: error.message });
  }
};

const directRecommendationSchema = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      product_name: { type: "STRING" }, // Matches frontend's expectation
      reason: { type: "STRING" }, // Explanation for the alternative
      image_url: { type: "STRING" }, // Placeholder for the image URL
      nutriments: {
        // Simplified nutriments for Gemini to generate
        type: "OBJECT",
        properties: {
          protein_g: { type: "NUMBER" },
          carbohydrates_g: { type: "NUMBER" },
          fat_g: { type: "NUMBER" },
        },
        required: ["protein_g", "carbohydrates_g", "fat_g"],
      },
      ingredients_text_en: { type: "STRING" }, // Placeholder for ingredients
    },
    required: ["product_name", "reason", "image_url", "nutriments"], // Make sure these are always present
  },
};

const jsonSchema = {
  type: "object",
  properties: {
    nutrients: {
      type: "object",
      properties: {
        protein: {
          type: "object",
          properties: {
            amount: { type: "number" },
            dailyValue: { type: ["number", "null"] },
            unit: { type: "string" },
          },
          required: ["amount", "unit"],
        },
        carbs: {
          type: "object",
          properties: {
            amount: { type: "number" },
            dailyValue: { type: ["number", "null"] },
            unit: { type: "string" },
          },
          required: ["amount", "unit"],
        },
        fat: {
          type: "object",
          properties: {
            amount: { type: "number" },
            dailyValue: { type: ["number", "null"] },
            unit: { type: "string" },
          },
          required: ["amount", "unit"],
        },
      },
      required: ["protein", "carbs", "fat"], // You must specify required properties explicitly
    },
    scale: {
      type: "object",
      properties: {
        overall: { type: "number" },
        reason: { type: "string" },
      },
      required: ["overall", "reason"],
    },
  },
  required: ["nutrients", "scale"],
};
const visionClient = new ImageAnnotatorClient();

const sendDataToGPT = async (req, res) => {
  try {
    const promptUser = req.body.text;
    const additionInfo = req.body.additionalInfo;
    const allergies = req.body.allergies;

    console.log(additionInfo);
    const genAI = new GoogleGenerativeAI(
      "AIzaSyCMGlUAjeXHonuG9-jqBOI8jfKd-6E1UcA"
    );
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const prompt = `${promptUser} make it in proper API format JSON key-value pair. Please don't give notes. Also, include the scale of how good the food is on a 1 to 10 scale with a reason as user have following conditions ${additionInfo} and have these allergies ${allergies} using this JSON schema:
      {
      nutrients :
          {
           
           propertyName : {
             amount : number
             unit : string
           }
  
          }
      scale : 
        {
          overall : number ,
          reason : string
        }
      }  
    `;

    console.log(prompt);
    const result = await model.generateContent(prompt);

    res.status(200).json({ message: result.response.text() });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const sendToDeepSeek = async (req, res) => {
  const { message, history } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const messages = [
      { role: "system", content: "You are a helpful assistant." },
      ...(history || []),
      { role: "user", content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: "deepseek-chat", // or "deepseek-coder" for code tasks
      messages,
    });

    const reply = completion.choices[0].message.content;
    res.status(200).json({ reply });
  } catch (error) {
    console.error("DeepSeek Error:", error);
    res.status(500).json({ error: "Failed to get response from DeepSeek" });
  }
};

const sendDataForRecommendation = async (req, res) => {
  console.log(
    "Starting sendDataForRecommendation (direct Gemini output with images)"
  );
  try {
    const userFood = req.body.text;
    const additionInfo = req.body.additionalInfo;
    const allergies = req.body.allergies;

    console.log("Request body:", req.body);
    console.log(
      "Extracted: Food:",
      userFood,
      "| Additional Info:",
      additionInfo,
      "| Allergies:",
      allergies
    );

    if (!userFood) {
      return res
        .status(400)
        .json({ error: "Missing 'text' (food name) in request body." });
    }

    const genAI = new GoogleGenerativeAI(
      "AIzaSyCMGlUAjeXHonuG9-jqBOI8jfKd-6E1UcA" // Use process.env.GEMINI_API_KEY if available
    );
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: directRecommendationSchema, // Use the new schema
      },
    });

    // Updated prompt to ask for direct alternatives with image URLs and other details
    const prompt = `Provide 3-5 healthy food alternatives for "${userFood}", considering the user has these conditions: ${additionInfo}, and these allergies: ${allergies}.
        For each alternative, include its name, a brief reason why it's a good alternative (e.g., "gluten-free", "lower in sugar"), a generic placeholder image URL (like "https://placehold.co/200x200?text=<FoodName>"), and estimated nutritional values (protein_g, carbohydrates_g, fat_g per 100g) and main ingredients.
        Ensure the output strictly follows the JSON schema:
        ${JSON.stringify(directRecommendationSchema)}
        Do NOT include any additional text or notes outside the JSON array.`;

    console.log("Gemini Recommendation Prompt:", prompt);
    const result = await model.generateContent(prompt);
    const aiResponseText = result.response.text();

    console.log("Gemini Raw Response Text:", aiResponseText);

    let parsedAlternatives;
    try {
      // Parse the JSON string received from Gemini
      parsedAlternatives = JSON.parse(aiResponseText);
      // Ensure it's an array for consistency with frontend expectation
      if (!Array.isArray(parsedAlternatives)) {
        throw new Error("Gemini response is not a JSON array as expected.");
      }
    } catch (jsonError) {
      console.error("Failed to parse Gemini's JSON response:", jsonError);
      console.log("Malformed response received:", aiResponseText);
      return res.status(500).json({
        error:
          "Failed to process AI response. Invalid JSON format from Gemini.",
        details: jsonError.message,
        geminiResponse: aiResponseText, // Include raw response for debugging
      });
    }

    // The frontend expects a 'products' array directly.
    // So, wrap Gemini's output in a 'products' object.
    res.status(200).json({ products: parsedAlternatives });
  } catch (error) {
    console.error("Error in sendDataForRecommendation (Gemini direct):", error);
    res.status(500).json({
      error: "Internal server error during Gemini direct recommendation.",
      details: error.message,
      geminiError: error.response?.data || error.message,
    });
  }
};

module.exports = {
  handleUserSignUp,
  handleUserLogin,
  handleViewProfile,
  changePassword,
  sendSupportEmail,
  sendDataToGPT,
  sendDataForRecommendation,
  handleRepeatTokenSend,
  forgetPasswordChange,
  forgetPasswordSend,
  addUserHistory,
  addProfileImage,
  getUserHistory,
  sendToDeepSeek,
};
