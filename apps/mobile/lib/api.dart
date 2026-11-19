import 'dart:convert';
import 'dart:io';
import 'models.dart';

class ApiFailure implements Exception {
  const ApiFailure(this.message, {this.code});
  final String message;
  final String? code;
  @override
  String toString() => message;
}

class StudentApi {
  StudentApi({this.token});
  static const baseUrl = String.fromEnvironment('API_URL',
      defaultValue: 'http://127.0.0.1:4000/api/v1/student');
  String? token;

  Future<Map<String, dynamic>> _request(String path,
      {String method = 'GET',
      Map<String, dynamic>? body,
      bool absolute = false}) async {
    final client = HttpClient()
      ..connectionTimeout = const Duration(seconds: 12);
    try {
      final request = await client.openUrl(
          method, Uri.parse(absolute ? path : '$baseUrl$path'));
      request.headers.contentType = ContentType.json;
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      if (token != null) {
        request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      }
      if (body != null) request.write(jsonEncode(body));
      final response = await request.close();
      final text = await utf8.decoder.bind(response).join();
      final data = text.isEmpty
          ? <String, dynamic>{}
          : jsonDecode(text) as Map<String, dynamic>;
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw ApiFailure(data['error'] ?? 'Something went wrong.',
            code: data['code']);
      }
      return data;
    } on SocketException {
      throw const ApiFailure(
          'Cannot reach the learning server. Check the connection and try again.');
    } finally {
      client.close(force: true);
    }
  }

  Future<String> requestOtp(String email) async =>
      (await _request('/auth/request-otp',
          method: 'POST', body: {'email': email}))['message'];
  Future<AppBranding> branding() async {
    final settingsUrl =
        baseUrl.replaceFirst(RegExp(r'/student/?$'), '/public/settings');
    final data = await _request(settingsUrl, absolute: true);
    return AppBranding.fromJson(
        data['data'] as Map<String, dynamic>, Uri.parse(baseUrl).origin);
  }

  Future<({String token, Student student})> verifyOtp(
      String email, String otp) async {
    final data = await _request('/auth/verify-otp',
        method: 'POST', body: {'email': email, 'otp': otp});
    final sessionToken = data['token'] as String;
    token = sessionToken;
    return (token: sessionToken, student: Student.fromJson(data['student']));
  }

  Future<Student> me() async =>
      Student.fromJson((await _request('/me'))['student']);
  Future<Student> updateProfile(
          String firstName, String lastName, String phone) async =>
      Student.fromJson((await _request('/me', method: 'PATCH', body: {
        'firstName': firstName,
        'lastName': lastName,
        'phone': phone
      }))['student']);
  Future<List<Tutorial>> tutorials() async =>
      ((await _request('/tutorials'))['data'] as List)
          .map((item) => Tutorial.fromJson(item))
          .toList();
  Future<List<Tutorial>> featuredTutorials() async =>
      ((await _request('/featured'))['data'] as List)
          .map((item) => Tutorial.fromJson(item))
          .toList();
  Future<void> saveReview(String courseId, int rating, String comment) async {
    await _request('/tutorials/$courseId/reviews',
        method: 'POST', body: {'rating': rating, 'comment': comment});
  }

  Future<List<SupportQuery>> supportQueries() async =>
      ((await _request('/support-queries'))['data'] as List)
          .map((item) => SupportQuery.fromJson(item))
          .toList();

  Future<SupportQuery> submitSupportQuery(
      String subject, String message) async {
    final data = await _request('/support-queries',
        method: 'POST', body: {'subject': subject, 'message': message});
    return SupportQuery.fromJson(data['data']);
  }
}
