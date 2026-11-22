#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>

static NSString * const TLScheme = @"traininglog";
static NSString * const TLBridgeTag = @"__TLSTORE__";
static NSString * const TLNullMark = @"__TL_NULL__";

#pragma mark - Persistent store backed by Documents/storage.json

@interface TLStorage : NSObject
+ (instancetype)shared;
- (NSString *)handle:(NSString *)payload;
@end

@implementation TLStorage {
    NSMutableDictionary<NSString *, NSString *> *_dict;
    NSString *_path;
}

+ (instancetype)shared {
    static TLStorage *instance;
    static dispatch_once_t once;
    dispatch_once(&once, ^{ instance = [[TLStorage alloc] init]; });
    return instance;
}

- (instancetype)init {
    if ((self = [super init])) {
        NSString *dir = [NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES) firstObject];
        _path = [dir stringByAppendingPathComponent:@"storage.json"];
        NSData *raw = [NSData dataWithContentsOfFile:_path];
        NSDictionary *loaded = raw ? [NSJSONSerialization JSONObjectWithData:raw options:0 error:NULL] : nil;
        _dict = [loaded isKindOfClass:[NSDictionary class]] ? [loaded mutableCopy] : [NSMutableDictionary dictionary];
    }
    return self;
}

- (void)persist {
    NSData *raw = [NSJSONSerialization dataWithJSONObject:_dict options:0 error:NULL];
    if (raw) [raw writeToFile:_path atomically:YES];
}

- (NSString *)handle:(NSString *)payload {
    NSData *raw = [payload dataUsingEncoding:NSUTF8StringEncoding];
    NSDictionary *q = raw ? [NSJSONSerialization JSONObjectWithData:raw options:0 error:NULL] : nil;
    if (![q isKindOfClass:[NSDictionary class]]) return @"";
    NSString *op = [q[@"op"] isKindOfClass:[NSString class]] ? q[@"op"] : @"";
    NSString *k  = [q[@"k"]  isKindOfClass:[NSString class]] ? q[@"k"]  : @"";
    if ([op isEqualToString:@"get"]) {
        NSString *v = _dict[k];
        return v ?: TLNullMark;
    }
    if ([op isEqualToString:@"set"]) {
        id v = q[@"v"];
        _dict[k] = [v isKindOfClass:[NSString class]] ? v : [NSString stringWithFormat:@"%@", v ?: @""];
        [self persist];
        return @"";
    }
    if ([op isEqualToString:@"remove"]) {
        [_dict removeObjectForKey:k];
        [self persist];
        return @"";
    }
    if ([op isEqualToString:@"clear"]) {
        [_dict removeAllObjects];
        [self persist];
        return @"";
    }
    if ([op isEqualToString:@"length"]) {
        return [NSString stringWithFormat:@"%lu", (unsigned long)_dict.count];
    }
    if ([op isEqualToString:@"key"]) {
        NSInteger i = [k integerValue];
        NSArray *keys = _dict.allKeys;
        return (i >= 0 && (NSUInteger)i < keys.count) ? keys[(NSUInteger)i] : @"";
    }
    return @"";
}
@end

#pragma mark - Local file scheme handler

static NSString *TLMimeType(NSString *path) {
    NSString *ext = path.pathExtension.lowercaseString;
    if ([ext isEqualToString:@"html"] || [ext isEqualToString:@"htm"]) return @"text/html; charset=utf-8";
    if ([ext isEqualToString:@"js"]) return @"application/javascript; charset=utf-8";
    if ([ext isEqualToString:@"css"]) return @"text/css; charset=utf-8";
    if ([ext isEqualToString:@"svg"]) return @"image/svg+xml";
    if ([ext isEqualToString:@"json"] || [ext isEqualToString:@"webmanifest"]) return @"application/json; charset=utf-8";
    if ([ext isEqualToString:@"png"]) return @"image/png";
    if ([ext isEqualToString:@"jpg"] || [ext isEqualToString:@"jpeg"]) return @"image/jpeg";
    return @"application/octet-stream";
}

@interface TLSchemeHandler : NSObject <WKURLSchemeHandler>
@end

@implementation TLSchemeHandler

- (void)webView:(WKWebView *)webView startURLSchemeTask:(id<WKURLSchemeTask>)task {
    NSURL *url = task.request.URL;
    NSString *path = url.path.length ? url.path : @"/index.html";
    if ([path isEqualToString:@"/"]) path = @"/index.html";
    NSString *rel = [path hasPrefix:@"/"] ? [path substringFromIndex:1] : path;
    if ([rel rangeOfString:@".."].location != NSNotFound) {
        [task didFailWithError:[NSError errorWithDomain:@"TL" code:403 userInfo:nil]];
        return;
    }
    NSString *base = [[[NSBundle mainBundle] bundlePath] stringByAppendingPathComponent:@"www"];
    NSData *body = [NSData dataWithContentsOfFile:[base stringByAppendingPathComponent:rel]];
    if (!body) {
        NSHTTPURLResponse *resp = [[NSHTTPURLResponse alloc] initWithURL:url
                                                             statusCode:404
                                                            HTTPVersion:@"HTTP/1.1"
                                                           headerFields:@{ @"Content-Type": @"text/plain; charset=utf-8" }];
        [task didReceiveResponse:resp];
        [task didReceiveData:[@"Not found" dataUsingEncoding:NSUTF8StringEncoding]];
        [task didFinish];
        return;
    }
    NSDictionary *headers = @{
        @"Content-Type": TLMimeType(rel),
        @"Content-Length": [NSString stringWithFormat:@"%lu", (unsigned long)body.length],
        @"Cache-Control": @"no-store",
        @"Access-Control-Allow-Origin": @"*"
    };
    NSHTTPURLResponse *resp = [[NSHTTPURLResponse alloc] initWithURL:url
                                                         statusCode:200
                                                        HTTPVersion:@"HTTP/1.1"
                                                       headerFields:headers];
    [task didReceiveResponse:resp];
    [task didReceiveData:body];
    [task didFinish];
}

- (void)webView:(WKWebView *)webView stopURLSchemeTask:(id<WKURLSchemeTask>)task {}
@end

#pragma mark - File operations (write to Documents/Exports + share)

@class TLPDFRenderer;   /* forward: PDF 渲染失败时借 TLFileOps 弹提示 */

@interface TLFileOps : NSObject
+ (NSString *)exportsDir;
+ (BOOL)writeData:(NSData *)data filename:(NSString *)filename;
+ (BOOL)writeBase64:(NSString *)b64 filename:(NSString *)filename;
+ (void)shareFile:(NSString *)filename presenter:(UIViewController *)presenter;
+ (void)alertOn:(UIViewController *)presenter message:(NSString *)message;
@end

#pragma mark - PDF renderer (offscreen WKWebView -> PDF file -> share)

/* 保留活跃实例，避免异步渲染期间被释放；完成或失败后从数组移除。 */
static NSMutableArray<TLPDFRenderer *> *TLActivePDFRenderers;

@interface TLPDFRenderer : NSObject <WKNavigationDelegate>
@property (nonatomic, strong) WKWebView *webView;
@property (nonatomic, copy) NSString *filename;
@property (nonatomic, weak) UIViewController *presenter;
- (void)render:(NSString *)html filename:(NSString *)filename presenter:(UIViewController *)presenter;
@end

@implementation TLPDFRenderer

- (void)render:(NSString *)html filename:(NSString *)filename presenter:(UIViewController *)presenter {
    if (!TLActivePDFRenderers) TLActivePDFRenderers = [NSMutableArray array];
    [TLActivePDFRenderers addObject:self];
    self.filename = filename;
    self.presenter = presenter;

    WKWebViewConfiguration *cfg = [[WKWebViewConfiguration alloc] init];
    WKWebView *wv = [[WKWebView alloc] initWithFrame:CGRectMake(0, 0, 595, 842) configuration:cfg];
    wv.navigationDelegate = self;
    self.webView = wv;
    /* A4 尺寸离屏渲染；不加入视图层级，createPDF 仍可渲染已加载内容 */
    [wv loadHTMLString:html baseURL:[NSURL URLWithString:[NSString stringWithFormat:@"%@://local/", TLScheme]]];
}

- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
    if (@available(iOS 14.0, *)) {
        [webView createPDFWithConfiguration:nil completionHandler:^(NSData * _Nullable pdfData, NSError * _Nullable error) {
            if (!error && pdfData) {
                if ([TLFileOps writeData:pdfData filename:self.filename]) {
                    dispatch_async(dispatch_get_main_queue(), ^{
                        [TLFileOps shareFile:self.filename presenter:self.presenter];
                    });
                } else {
                    [TLFileOps alertOn:self.presenter message:@"PDF 写入失败，请重试"];
                }
            } else {
                [TLFileOps alertOn:self.presenter message:@"PDF 生成失败，请重试"];
            }
            [TLActivePDFRenderers removeObject:self];
        }];
    } else {
        [TLFileOps alertOn:self.presenter message:@"此系统版本不支持直接生成 PDF"];
        [TLActivePDFRenderers removeObject:self];
    }
}

- (void)webView:(WKWebView *)webView didFailNavigation:(WKNavigation *)navigation withError:(NSError *)error {
    [TLFileOps alertOn:self.presenter message:@"PDF 页面加载失败，请重试"];
    [TLActivePDFRenderers removeObject:self];
}
@end

#pragma mark - File operations implementation

@implementation TLFileOps

+ (NSString *)exportsDir {
    NSString *dir = [NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES) firstObject];
    NSString *ex = [dir stringByAppendingPathComponent:@"Exports"];
    [[NSFileManager defaultManager] createDirectoryAtPath:ex withIntermediateDirectories:YES attributes:nil error:NULL];
    return ex;
}

/* 只取最后一段文件名并去掉控制字符，防止路径逃逸写入沙盒外。 */
+ (NSString *)safeName:(NSString *)filename {
    NSString *base = [[filename componentsSeparatedByString:@"/"] lastObject] ?: filename;
    base = [[base componentsSeparatedByString:@"\\"] lastObject] ?: base;
    NSMutableString *out = [NSMutableString string];
    for (NSInteger i = 0; i < base.length; i++) {
        unichar ch = [base characterAtIndex:i];
        if (ch >= 32 && ch != 127) [out appendFormat:@"%C", ch];
    }
    return out.length ? out : @"export.bin";
}

+ (BOOL)writeData:(NSData *)data filename:(NSString *)filename {
    if (!data) return NO;
    NSString *path = [[self exportsDir] stringByAppendingPathComponent:[self safeName:filename]];
    return [data writeToFile:path atomically:YES];
}

+ (BOOL)writeBase64:(NSString *)b64 filename:(NSString *)filename {
    if (!b64.length) return NO;
    NSData *data = [[NSData alloc] initWithBase64EncodedString:b64 options:NSDataBase64DecodingIgnoreUnknownCharacters];
    return [self writeData:data filename:filename];
}

+ (void)shareFile:(NSString *)filename presenter:(UIViewController *)presenter {
    NSString *path = [[self exportsDir] stringByAppendingPathComponent:[self safeName:filename]];
    NSURL *url = [NSURL fileURLWithPath:path];
    if (![[NSFileManager defaultManager] fileExistsAtPath:path]) {
        [self alertOn:presenter message:@"文件不存在，导出可能失败"];
        return;
    }
    UIActivityViewController *avc = [[UIActivityViewController alloc] initWithActivityItems:@[url] applicationActivities:nil];
    if (avc.popoverPresentationController) {
        avc.popoverPresentationController.sourceView = presenter.view;
        avc.popoverPresentationController.sourceRect = CGRectMake(CGRectGetMidX(presenter.view.bounds), CGRectGetMidY(presenter.view.bounds), 1, 1);
    }
    [presenter presentViewController:avc animated:YES completion:nil];
}

+ (void)alertOn:(UIViewController *)presenter message:(NSString *)message {
    if (!presenter) return;
    UIAlertController *ac = [UIAlertController alertControllerWithTitle:@"导出提示" message:message preferredStyle:UIAlertControllerStyleAlert];
    [ac addAction:[UIAlertAction actionWithTitle:@"好" style:UIAlertActionStyleDefault handler:nil]];
    dispatch_async(dispatch_get_main_queue(), ^{ [presenter presentViewController:ac animated:YES completion:nil]; });
}
@end

#pragma mark - Root view controller

@interface TLViewController : UIViewController <WKUIDelegate, WKNavigationDelegate, UIDocumentPickerDelegate>
@end

@implementation TLViewController {
    WKWebView *_webView;
    void (^_openPanelCompletion)(NSArray<NSURL *> *);
}

- (void)viewDidLoad {
    [super viewDidLoad];
    UIColor *bg = [UIColor colorWithRed:14.0/255.0 green:16.0/255.0 blue:20.0/255.0 alpha:1.0];
    self.view.backgroundColor = bg;

    WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
    config.websiteDataStore = [WKWebsiteDataStore defaultDataStore];
    [config setURLSchemeHandler:[[TLSchemeHandler alloc] init] forURLScheme:TLScheme];

    WKUserContentController *content = [[WKUserContentController alloc] init];
    NSString *jsPath = [[NSBundle mainBundle] pathForResource:@"bridge" ofType:@"js"];
    NSString *js = jsPath ? [NSString stringWithContentsOfFile:jsPath encoding:NSUTF8StringEncoding error:NULL] : nil;
    if (js.length) {
        WKUserScript *script = [[WKUserScript alloc] initWithSource:js
                                                    injectionTime:WKUserScriptInjectionTimeAtDocumentStart
                                                 forMainFrameOnly:YES];
        [content addUserScript:script];
    }
    config.userContentController = content;

    WKWebView *webView = [[WKWebView alloc] initWithFrame:CGRectZero configuration:config];
    webView.UIDelegate = self;
    webView.navigationDelegate = self;
    webView.backgroundColor = bg;
    webView.opaque = YES;
    webView.scrollView.bounces = NO;
    webView.scrollView.contentInsetAdjustmentBehavior = UIScrollViewContentInsetAdjustmentNever;
    webView.translatesAutoresizingMaskIntoConstraints = NO;
    [self.view addSubview:webView];
    [NSLayoutConstraint activateConstraints:@[
        [webView.topAnchor constraintEqualToAnchor:self.view.topAnchor],
        [webView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
        [webView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
        [webView.bottomAnchor constraintEqualToAnchor:self.view.bottomAnchor],
    ]];
    _webView = webView;

    /* 键盘高度注入：iOS WKWebView 在视口受限时，网页里的 visualViewport
       不会随键盘变化，纯 JS 算不出键盘高度，底部输入弹层会被键盘盖住。
       这里监听 UIKit 键盘通知，把精确高度注入 window.__setKeyboardHeight，
       网页据此把 fixed 弹层抬到键盘上方。 */
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(keyboardWillChange:)
                                                 name:UIKeyboardWillShowNotification
                                               object:nil];
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(keyboardWillChange:)
                                                 name:UIKeyboardWillChangeFrameNotification
                                               object:nil];
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(keyboardWillHide:)
                                                 name:UIKeyboardWillHideNotification
                                               object:nil];

    NSURL *url = [NSURL URLWithString:[NSString stringWithFormat:@"%@://local/index.html", TLScheme]];
    [webView loadRequest:[NSURLRequest requestWithURL:url]];
}

/* 把键盘 frame 换算到 self.view 坐标系，算出它遮住网页底部的高度。 */
- (CGFloat)keyboardOverlayHeight:(NSNotification *)note {
    NSDictionary *info = note.userInfo ?: @{};
    CGRect kbFrame = [info[UIKeyboardFrameEndUserInfoKey] CGRectValue];
    if (CGRectIsEmpty(kbFrame)) return 0;
    CGRect inView = [self.view convertRect:kbFrame fromView:nil];
    CGFloat viewH = self.view.bounds.size.height;
    CGFloat visibleTop = CGRectGetMinY(inView);
    if (visibleTop >= viewH) return 0;   /* 键盘已收起（frame 落到屏幕外） */
    return MAX(0, viewH - visibleTop);
}

- (void)keyboardWillChange:(NSNotification *)note {
    CGFloat h = [self keyboardOverlayHeight:note];
    NSString *js = [NSString stringWithFormat:@"window.__setKeyboardHeight && window.__setKeyboardHeight(%.0f)", h];
    [_webView evaluateJavaScript:js completionHandler:nil];
}

- (void)keyboardWillHide:(NSNotification *)note {
    [_webView evaluateJavaScript:@"window.__setKeyboardHeight && window.__setKeyboardHeight(0)" completionHandler:nil];
}

- (void)dealloc {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
}

#pragma mark - WKUIDelegate: prompt bridge (storage + native capabilities)

- (void)webView:(WKWebView *)webView
runJavaScriptTextInputPanelWithPrompt:(NSString *)prompt
    defaultText:(NSString *)defaultText
initiatedByFrame:(WKFrameInfo *)frame
completionHandler:(void (^)(NSString * _Nullable))completionHandler {
    if (![prompt isEqualToString:TLBridgeTag]) { completionHandler(@""); return; }

    NSData *raw = [defaultText dataUsingEncoding:NSUTF8StringEncoding];
    NSDictionary *q = raw ? [NSJSONSerialization JSONObjectWithData:raw options:0 error:NULL] : nil;
    if (![q isKindOfClass:[NSDictionary class]]) { completionHandler(@""); return; }
    NSString *op = [q[@"op"] isKindOfClass:[NSString class]] ? q[@"op"] : @"";
    NSString *k  = [q[@"k"]  isKindOfClass:[NSString class]] ? q[@"k"]  : @"";
    NSString *v  = [q[@"v"]  isKindOfClass:[NSString class]] ? q[@"v"]  : @"";

    /* 写文件 + 系统分享面板：导出 JSON / CSV / TCX / ZIP 都走这里 */
    if ([op isEqualToString:@"saveFile"]) {
        BOOL ok = [TLFileOps writeBase64:v filename:k];
        if (ok) {
            dispatch_async(dispatch_get_main_queue(), ^{
                [TLFileOps shareFile:k presenter:self];
            });
        } else {
            [TLFileOps alertOn:self message:@"文件写入失败，请重试"];
        }
        completionHandler(ok ? @"1" : @"0");
        return;
    }
    /* 生成 PDF：异步渲染，受理即返回 1，完成后弹分享面板 */
    if ([op isEqualToString:@"savePDF"]) {
        TLPDFRenderer *renderer = [[TLPDFRenderer alloc] init];
        [renderer render:v filename:k presenter:self];
        completionHandler(@"1");
        return;
    }
    /* 复制到系统剪贴板 */
    if ([op isEqualToString:@"copyText"]) {
        [UIPasteboard generalPasteboard].string = v;
        completionHandler(v.length ? @"1" : @"0");
        return;
    }
    /* 组间休息触觉反馈 */
    if ([op isEqualToString:@"haptic"]) {
        if (@available(iOS 10.0, *)) {
            UIImpactFeedbackGenerator *g = [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleMedium];
            [g impactOccurred];
        }
        completionHandler(@"1");
        return;
    }
    /* 其余存储 op 交给 TLStorage */
    completionHandler([[TLStorage shared] handle:defaultText ?: @""] ?: @"");
}

#pragma mark - WKUIDelegate: file picker for <input type="file"> (import backup)

- (void)webView:(WKWebView *)webView
runOpenPanelWithParameters:(WKOpenPanelParameters *)parameters
    initiatedByFrame:(WKFrameInfo *)frame
   completionHandler:(void (^)(NSArray<NSURL *> * _Nullable URLs))completionHandler {
    _openPanelCompletion = completionHandler;
    /* 用字符串 UTI，避免引入 UniformTypeIdentifiers framework；允许所有文档，
       因为用户可能选 JSON 备份，也可能选其他文本文件。 */
    UIDocumentPickerViewController *picker = [[UIDocumentPickerViewController alloc]
        initWithDocumentTypes:@[@"public.json", @"public.text", @"public.data"]
                       inMode:UIDocumentPickerModeOpen];
    picker.delegate = self;
    picker.modalPresentationStyle = UIModalPresentationFormSheet;
    [self presentViewController:picker animated:YES completion:nil];
}

- (void)documentPicker:(UIDocumentPickerViewController *)controller didPickDocumentsAtURLs:(NSArray<NSURL *> *)urls {
    if (_openPanelCompletion) _openPanelCompletion(urls);
    _openPanelCompletion = nil;
}

- (void)documentPickerWasCancelled:(UIDocumentPickerViewController *)controller {
    if (_openPanelCompletion) _openPanelCompletion(nil);
    _openPanelCompletion = nil;
}

#pragma mark - WKNavigationDelegate

- (void)webView:(WKWebView *)webView didFailNavigation:(WKNavigation *)navigation withError:(NSError *)error {
    NSLog(@"[TrainingLog] navigation failed: %@", error.localizedDescription);
}

- (void)webView:(WKWebView *)webView didFailProvisionalNavigation:(WKNavigation *)navigation withError:(NSError *)error {
    NSLog(@"[TrainingLog] provisional navigation failed: %@", error.localizedDescription);
}
@end

#pragma mark - App delegate / entry point

@interface TLAppDelegate : UIResponder <UIApplicationDelegate>
@property (nonatomic, strong) UIWindow *window;
@end

@implementation TLAppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
    self.window.backgroundColor = [UIColor blackColor];
    self.window.rootViewController = [[TLViewController alloc] init];
    [self.window makeKeyAndVisible];
    return YES;
}
@end

int main(int argc, char *argv[]) {
    @autoreleasepool {
        return UIApplicationMain(argc, argv, nil, NSStringFromClass([TLAppDelegate class]));
    }
}
