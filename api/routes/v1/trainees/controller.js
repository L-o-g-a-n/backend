const { Trainee } = require('../../../../models');
const { createResponse } = require('../../../../utils/response');
const { JSON_WEB_TOKEN_ERROR, INVALID_TRAINEE_PHONE, INVALID_TRAINEE_PASSWORD, ALREADY_LOGGED_OUT, INVALID_FORMAT_PHONE, INVALID_PHONE_LENGTH, INVALID_FORMAT_PASSWORD, DUPLICATED_PHONE, DUPLICATED_PASSWORD } = require('../../../../errors');
const { SALT_ROUNDS, JWT_SECRET_KEY_FILE } = require('../../../../env');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { join } = require('path');
const { verifyToken } = require('../../../../utils/jwt');

const register = async(req,res,next) => {
  const {body: {traineePhoneNumber, traineePassword}} = req;
  try {
    if(traineePhoneNumber.search(/^010/) == -1) //휴대폰 번호가 010으로 시작하는지 검사
      return next(INVALID_FORMAT_PHONE);
    if(traineePhoneNumber.search(/^\d{11}$/))  //휴대폰 번호가 숫자 11자리인지 검사
      return next(INVALID_PHONE_LENGTH);
    const duplicateTest = await Trainee.findByPk(traineePhoneNumber);
    if(duplicateTest) //기존에 동일한 휴대폰 번호의 회원이 있는지 검사
      return next(DUPLICATED_PHONE);
    if(traineePassword.search(/^[A-Za-z0-9]{6,12}$/) == -1) //비밀번호가 대소문자 알파벳,숫자 6~12자로 이루어져 있는지 검사 
      return next(INVALID_FORMAT_PASSWORD);
    req.body.traineePassword = bcrypt.hashSync(traineePassword, parseInt(SALT_ROUNDS));
    const trainee = await Trainee.create(req.body);
    return res.json(createResponse(res, trainee));
  } catch (error) {
    console.error(error);
    next(error);
  }
};

const login = async(req,res,next) => {
  // const JWT_SECRET_KEY = fs.readFileSync(join(__dirname, '../../../../keys/', JWT_SECRET_KEY_FILE));
  const { traineePhoneNumber, traineePassword } = req.body;
  try {
    const trainee = await Trainee.findOne({where: {traineePhoneNumber}});
    if(!trainee) return next(INVALID_TRAINEE_PHONE);
    const same = bcrypt.compareSync(traineePassword, trainee.traineePassword);
    if(!same)
      return next(INVALID_TRAINEE_PASSWORD);

    // const refreshToken = await jwt.sign({}, JWT_SECRET_KEY_FILE, {algorithm: 'HS512', expiresIn: '14d'});  //refreshToken은 DB에 저장
    // const check = await RefreshToken.findOne({where: {traineeId: trainee.id}});
    // if(check) {
    //   await check.update({refreshToken});
    // }
    // else {
    //   const token = await RefreshToken.create({refreshToken});
    //   await token.setTrainee(trainee);  //저장 후 올바른 Trainee 인스턴스와 관계 맺어주기
    // }

    const accessToken = await jwt.sign({traineeId: trainee.id}, JWT_SECRET_KEY_FILE, {algorithm: 'HS512', expiresIn: '7d'});  //accessToken 생성 
    //res.cookie('refreshToken', refreshToken, {httpOnly: true}); //refreshToken은 secure, httpOnly 옵션을 가진 쿠키로 보내 CSRF 공격을 방어
    //res.cookie('accessToken', accessToken, {httpOnly: true}); //accessToken은 secure, httpOnly 옵션을 가진 쿠키로 보내 CSRF 공격을 방어
    //원래는 accessToken은 authorization header에 보내주는 게 보안상 좋지만, MVP 모델에서는 간소화
    return res.json(createResponse(res, {accessToken}));
    } catch (error) {
    console.error(error);
    next(error);
  }
};

const logout = async(req,res,next) => {
  try {
    const accessToken = verifyToken(req.headers.authorization.split('Bearer ')[1]);
    if(!accessToken)
      return next(JSON_WEB_TOKEN_ERROR);
    var trainee;
    if(accessToken.trainerId)
      return next(INVALID_TRAINEE_PHONE);

    trainee = await Trainee.findByPk(accessToken.traineeId);
    if(!trainee)
      return next(INVALID_TRAINEE_PHONE);

    // const refreshToken = await RefreshToken.destroy({where: {traineeId: trainee.id}});  //db에서 trainer와 연결된 refreshToken 제거
    // if(!refreshToken)
    //   return next(ALREADY_LOGGED_OUT);
    // res.clearCookie('refreshToken');  //쿠키에 저장된 모든 토큰을 제거
    // res.clearCookie('accessToken');
    //이 부분에서 클라이언트가 알아서 로컬에 저장한 AccessToken과 RefreshToken을 날려버려야함!!!!!!!!!!!!!!!!!
    return res.json(createResponse(res));
  } catch (error) {
    console.error(error);
    next(error);
  }
};

const resetPassword = async(req,res,next) => {
  const { traineePassword } = req.body;
  try {
    const accessToken = verifyToken(req.headers.authorization.split('Bearer ')[1]);
    if(!accessToken)
      return next(JSON_WEB_TOKEN_ERROR);
    var trainee;
    if(accessToken.trainerId)
      return next(INVALID_TRAINEE_PHONE);

    trainee = await Trainee.findByPk(accessToken.traineeId);
    if(!trainee)
      return next(INVALID_TRAINEE_PHONE);

    
    // const trainee = await Trainee.findByPk(traineePhoneNumber);
    // if(!trainee) return next(INVALID_TRAINEE_PHONE);
    const same = bcrypt.compareSync(traineePassword, trainee.traineePassword);
    if(same)  //기존의 비밀번호와 동일한 비밀번호는 아닌지 검사
      return next(DUPLICATED_PASSWORD);
    if(traineePassword.search(/^[A-Za-z0-9]{6,12}$/) == -1) //비밀번호가 대소문자 알파벳,숫자 6~12자로 이루어져 있는지 검사 
      return next(INVALID_FORMAT_PASSWORD);
    const newTraineePassword = bcrypt.hashSync(traineePassword, parseInt(SALT_ROUNDS));
    await trainee.update({traineePassword: newTraineePassword});
    // await RefreshToken.destroy({where: {traineeId: trainee.id}});  //db에서 trainer와 연결된 refreshToken 제거
    // res.clearCookie('refreshToken');  //쿠키에 저장된 모든 토큰을 제거
    // res.clearCookie('accessToken');
    //이 부분에서 클라이언트가 알아서 로컬에 저장한 AccessToken과 RefreshToken을 날려버려야함!!!!!!!!!!!!!!!!!
    return res.json(createResponse(res));
  } catch (error) {
    console.error(error);
    next(error);
  }
};

const getTrainee = async(req,res,next) => {
  try {
    const accessToken = verifyToken(req.headers.authorization.split('Bearer ')[1]);
    if(!accessToken)
      return next(JSON_WEB_TOKEN_ERROR);
    var trainee;
    if(accessToken.trainerId)
      return next(INVALID_TRAINEE_PHONE);

    trainee = await Trainee.findByPk(accessToken.traineeId);
    if(!trainee)
      return next(INVALID_TRAINEE_PHONE);
    
    return res.json(createResponse(res, trainee));
  } catch (error) {
    console.error(error);
    next(error);
  }
};

const test = async(req,res,next) => {
  try {
    console.log("성 공 적");
    console.log("이것은 Access");
    console.log(req.headers.authorization.split('Bearer ')[1]);
    // console.log("이것은 Refresh");
    // console.log(req.headers.refresh);
    return res.json(createResponse(res, "성공했습니다."));
  } catch (error) {
    console.error(error);
    next(error);
  }
};

module.exports = { register, login, logout, resetPassword, getTrainee, test };